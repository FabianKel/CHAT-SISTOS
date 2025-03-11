const WebSocket = require('ws');
const net = require('net');
const crypto = require('crypto');

// WebSocket server for frontend
const WS_PORT = 50213;
// TCP server port
const TCP_PORT = 50213;
const TCP_HOST = '127.0.0.1';

// Create WebSocket server
const wss = new WebSocket.Server({ port: WS_PORT });

wss.on('connection', function connection(ws) {
  console.log('Cliente web conectado');
  
  // Conexión al servidor TCP
  const tcpClient = new net.Socket();
  
  // Flag para rastrear si ya hemos completado el handshake
  let handshakeCompleted = false;
  
  tcpClient.connect(TCP_PORT, TCP_HOST, function() {
    console.log('Conectado al servidor TCP en ' + TCP_HOST + ':' + TCP_PORT);
    
    // Generar una clave aleatoria para el handshake WebSocket
    const key = crypto.randomBytes(16).toString('base64');
    
    // Enviar solicitud de actualización WebSocket
    const upgradeRequest = 
      `GET / HTTP/1.1\r\n` +
      `Host: ${TCP_HOST}:${TCP_PORT}\r\n` +
      `Upgrade: websocket\r\n` +
      `Connection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${key}\r\n` +
      `Sec-WebSocket-Version: 13\r\n` +
      `Origin: http://${TCP_HOST}:${TCP_PORT}\r\n` +
      `\r\n`;
    
    tcpClient.write(upgradeRequest);
  });
  
  // Variable para acumular datos TCP
  let tcpBuffer = '';
  
  // Recibir respuestas del servidor TCP
  tcpClient.on('data', function(data) {
    const dataStr = data.toString();
    console.log('Respuesta del servidor TCP:', dataStr);
    
    // Acumular datos en buffer
    tcpBuffer += dataStr;
    
    if (!handshakeCompleted) {
      // Verificar si hemos recibido la respuesta completa al handshake
      if (tcpBuffer.includes('HTTP/1.1 101') && tcpBuffer.includes('\r\n\r\n')) {
        console.log('Handshake WebSocket completado con éxito');
        handshakeCompleted = true;
        tcpBuffer = ''; // Limpiar buffer después del handshake
      } else if (tcpBuffer.includes('HTTP/1.1 4') && tcpBuffer.includes('\r\n\r\n')) {
        // Recibimos un error HTTP durante el handshake
        console.error('Error en handshake WebSocket:', tcpBuffer);
        ws.send(JSON.stringify({
          respuesta: "ERROR",
          razon: "Error en la conexión WebSocket con el servidor"
        }));
        ws.close();
        return;
      }
    } else {
      // Una vez que el handshake está completo, necesitamos manejar los frames WebSocket
      // Por simplicidad, asumimos que los datos recibidos ya están desenmarcados
      // En un escenario real, necesitaríamos implementar el protocolo WebSocket completo
      
      // Intentar procesar como JSON
      try {
        // Eliminar cualquier carácter de control que pueda estar presente
        const cleanData = tcpBuffer.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        if (cleanData) {
          console.log('Enviando datos al cliente web:', cleanData);
          ws.send(cleanData);
        }
        tcpBuffer = ''; // Limpiar buffer después de procesar
      } catch (error) {
        console.error('Error al procesar datos:', error);
        // Si no podemos procesar como JSON, enviamos los datos brutos
        if (tcpBuffer) {
          ws.send(tcpBuffer);
          tcpBuffer = '';
        }
      }
    }
  });
  
  // Recibir mensajes desde el cliente web
  ws.on('message', function incoming(message) {
    console.log('Mensaje recibido del cliente web:', message.toString());
    
    if (handshakeCompleted) {
      // Si el handshake está completo, enviamos el mensaje tal cual
      // En un escenario real, necesitaríamos enmarcar el mensaje según el protocolo WebSocket
      tcpClient.write(message.toString());
    } else {
      // Si aún no hemos completado el handshake, lo guardamos para enviarlo después
      console.log('Handshake no completado, guardando mensaje para envío posterior');
    }
  });
  
  // Manejar errores de conexión TCP
  tcpClient.on('error', function(err) {
    console.error('Error en conexión TCP:', err);
    ws.send(JSON.stringify({
      respuesta: "ERROR",
      razon: "Error de conexión con el servidor"
    }));
    ws.close();
  });
  
  // Manejo de desconexiones
  ws.on('close', function() {
    console.log('Cliente web desconectado');
    tcpClient.destroy();
  });
  
  tcpClient.on('close', function() {
    console.log('Conexión TCP cerrada');
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });
});

// Manejar errores del servidor WebSocket
wss.on('error', function(err) {
  console.error('Error en servidor WebSocket:', err);
});

console.log('Servidor WebSocket ejecutándose en puerto ' + WS_PORT);
console.log('Redirigiendo tráfico al servidor TCP en ' + TCP_HOST + ':' + TCP_PORT);