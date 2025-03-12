// bridge_server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const net = require('net');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Puerto para la aplicación web
const WEB_PORT = 3000;
// Dirección y puerto del servidor C
const C_SERVER_HOST = '127.0.0.1';
const C_SERVER_PORT = 50213;

// Servir archivos estáticos
app.use(express.static('public'));

// Mapa para mantener las conexiones TCP de los clientes
const clientConnections = new Map();

io.on('connection', (socket) => {
  console.log('Usuario web conectado');
  let tcpClient = null;

  // Cuando un usuario se registra desde el frontend
  socket.on('register', (userData) => {
    // Crear conexión TCP con el servidor C
    tcpClient = new net.Socket();
    
    tcpClient.connect(C_SERVER_PORT, C_SERVER_HOST, () => {
      console.log('Conectado al servidor C');
      
      // Enviar mensaje de registro
      const registerMsg = {
        tipo: 'REGISTRO',
        usuario: userData.username,
        direccionIP: userData.ip || socket.handshake.address
      };
      
      tcpClient.write(JSON.stringify(registerMsg));
    });
    
    // Manejar datos recibidos del servidor C
    tcpClient.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString().trim());
        console.log('Mensaje del servidor C:', message);
        socket.emit('serverMessage', message);
      } catch (e) {
        console.error('Error al parsear JSON:', e);
        socket.emit('serverMessage', {
          respuesta: 'ERROR',
          razon: 'Error de formato en mensaje del servidor'
        });
      }
    });
    
    // Manejar errores y cierre de conexión
    tcpClient.on('error', (err) => {
      console.error('Error en conexión TCP:', err);
      socket.emit('serverMessage', {
        respuesta: 'ERROR',
        razon: 'Error de conexión con el servidor'
      });
    });
    
    tcpClient.on('close', () => {
      console.log('Conexión con servidor C cerrada');
      socket.emit('serverMessage', {
        respuesta: 'ERROR',
        razon: 'Conexión con el servidor cerrada'
      });
    });
    
    // Guardar la conexión TCP asociada a este socket
    clientConnections.set(socket.id, tcpClient);
  });
  
  // Cuando se recibe un mensaje desde el frontend
  socket.on('clientMessage', (message) => {
    const tcpClient = clientConnections.get(socket.id);
    if (tcpClient) {
      tcpClient.write(JSON.stringify(message));
    } else {
      socket.emit('serverMessage', {
        respuesta: 'ERROR',
        razon: 'No estás conectado al servidor'
      });
    }
  });
  
  // Cuando el socket web se desconecta
  socket.on('disconnect', () => {
    console.log('Usuario web desconectado');
    const tcpClient = clientConnections.get(socket.id);
    if (tcpClient) {
      tcpClient.end();
      clientConnections.delete(socket.id);
    }
  });
});

server.listen(WEB_PORT, () => {
  console.log(`Servidor web escuchando en http://localhost:${WEB_PORT}`);
});