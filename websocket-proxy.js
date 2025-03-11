const WebSocketServer = require('ws').WebSocketServer;
const net = require('net');

// Usar puertos diferentes para WebSocket y TCP
const WS_PORT = 50213;  // Puerto para el WebSocket (frontend)
const TCP_HOST = '127.0.0.1';
const TCP_PORT = 50214;  // Puerto para comunicarse con el servidor C (cambiado)

const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', function connection(ws) {
  console.log('✅ Cliente web conectado');
  
  // Cola de mensajes pendientes
  const messageQueue = [];
  
  // Crear conexión TCP con el servidor C
  const tcpClient = new net.Socket();
  
  let isConnected = false;
  let connectionTimeout = null;
  
  // Establecer un timeout para la conexión TCP
  connectionTimeout = setTimeout(() => {
    if (!isConnected) {
      console.error('❌ Timeout al conectar con el servidor C');
      try {
        ws.send(JSON.stringify({
          respuesta: "ERROR",
          razon: "Timeout al conectar con el servidor C"
        }));
      } catch (error) {
        console.error('Error enviando mensaje de error:', error);
      }
      tcpClient.destroy();
    }
  }, 5000);
  
  tcpClient.connect(TCP_PORT, TCP_HOST, function() {
    console.log('📡 Conectado al servidor C');
    isConnected = true;
    clearTimeout(connectionTimeout);
    
    // Procesar mensajes en cola
    while (messageQueue.length > 0) {
      const pendingMsg = messageQueue.shift();
      console.log('📤 Enviando mensaje en cola al servidor C:', pendingMsg);
      tcpClient.write(pendingMsg + '\n');
    }
  });

  // Manejar mensajes del cliente web
  ws.on('message', function incoming(message) {
    console.log('📤 Web -> C:', message.toString());
    
    try {
      // Asegurarse que el mensaje es JSON válido
      JSON.parse(message);
      
      if (!isConnected) {
        // Añadir a la cola de mensajes
        console.log('Añadiendo mensaje a la cola - TCP aún no conectado');
        messageQueue.push(message.toString());
        return;
      }
      
      // Enviar mensaje al servidor C con un salto de línea final 
      tcpClient.write(message + '\n');
    } catch (error) {
      console.error('Error enviando mensaje al servidor C:', error);
      try {
        ws.send(JSON.stringify({
          respuesta: "ERROR",
          razon: "Formato JSON inválido"
        }));
      } catch (wsError) {
        console.error('Error enviando mensaje de error al cliente web:', wsError);
      }
    }
  });

  // Manejar mensajes del servidor C
  let buffer = '';
  tcpClient.on('data', function(data) {
    const dataStr = data.toString();
    console.log('📥 C -> Web (raw):', dataStr);
    
    // Si recibimos una respuesta HTTP, es un error
    if (dataStr.startsWith('HTTP/')) {
      console.error('Respuesta HTTP detectada, posible error de protocolo:', dataStr);
      try {
        ws.send(JSON.stringify({
          respuesta: "ERROR",
          razon: "Error de comunicación con el servidor"
        }));
      } catch (error) {
        console.error('Error enviando mensaje de error al cliente web:', error);
      }
      return;
    }
    
    buffer += dataStr;
    
    // Intentar procesar mensaje completo (terminado en \n)
    try {
      // Dividir por \n y filtrar líneas vacías
      const lines = buffer.split('\n');
      
      // Procesar todas las líneas completas
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line) {
          try {
            // Verificar que sea JSON válido
            const jsonObj = JSON.parse(line);
            console.log('📥 C -> Web (procesado):', jsonObj);
            
            // Si es un registro exitoso pero no tiene el tipo, lo agregamos
            if (jsonObj.respuesta === "Registro exitoso" && !jsonObj.tipo) {
              jsonObj.tipo = "REGISTRO_EXITOSO";
              ws.send(JSON.stringify(jsonObj));
              console.log('📤 Enviado a cliente web (modificado):', JSON.stringify(jsonObj));
            } else {
              // Enviar el mensaje tal cual al cliente web
              ws.send(line);
              console.log('📤 Enviado a cliente web:', line);
            }
          } catch (error) {
            console.error('Error procesando respuesta del servidor C:', error, 'Mensaje:', line);
            try {
              ws.send(JSON.stringify({
                respuesta: "ERROR",
                razon: "Respuesta del servidor no es JSON válido"
              }));
            } catch (wsError) {
              console.error('Error enviando mensaje de error al cliente web:', wsError);
            }
          }
        }
      }
      
      // Mantener el buffer solo con la última línea si no termina en \n
      if (buffer.endsWith('\n')) {
        // Si la última línea también está completa (termina en \n)
        const lastLine = lines[lines.length - 1].trim();
        if (lastLine) {
          try {
            const jsonObj = JSON.parse(lastLine);
            console.log('📥 C -> Web (procesado última línea):', jsonObj);
            
            // Si es un registro exitoso pero no tiene el tipo, lo agregamos
            if (jsonObj.respuesta === "Registro exitoso" && !jsonObj.tipo) {
              jsonObj.tipo = "REGISTRO_EXITOSO";
              ws.send(JSON.stringify(jsonObj));
              console.log('📤 Enviado a cliente web (modificado):', JSON.stringify(jsonObj));
            } else {
              // Enviar el mensaje tal cual al cliente web
              ws.send(lastLine);
              console.log('📤 Enviado a cliente web:', lastLine);
            }
          } catch (error) {
            console.error('Error procesando última línea:', error, 'Mensaje:', lastLine);
          }
        }
        buffer = '';
      } else {
        buffer = lines[lines.length - 1];
      }
    } catch (error) {
      console.error('Error procesando buffer:', error);
    }
  });

  // Manejar desconexiones
  ws.on('close', function() {
    console.log('🔴 Cliente web desconectado');
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
    }
    tcpClient.destroy();
  });

  tcpClient.on('close', function() {
    console.log('🔴 Conexión con servidor C cerrada');
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
    }
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(JSON.stringify({
          respuesta: "ERROR",
          razon: "Servidor desconectado"
        }));
        ws.close();
      } catch (error) {
        console.error('Error cerrando conexión WebSocket:', error);
      }
    }
  });

  // Manejar errores
  tcpClient.on('error', function(err) {
    console.error('❌ Error en conexión TCP:', err.message);
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
    }
    
    try {
      ws.send(JSON.stringify({
        respuesta: "ERROR",
        razon: "Error de conexión con el servidor: " + err.message
      }));
      
      if (ws.readyState === ws.OPEN) {
        ws.close();
      }
    } catch (wsError) {
      console.error('Error enviando mensaje de error al cliente web:', wsError);
    }
  });

  ws.on('error', function(err) {
    console.error('❌ Error en WebSocket:', err);
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
    }
    tcpClient.destroy();
  });
});

console.log(`🚀 Proxy WebSocket corriendo en puerto ${WS_PORT}, conectando a servidor C en puerto ${TCP_PORT}`);