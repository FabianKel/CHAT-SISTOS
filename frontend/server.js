const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const net = require('net');

const app = express();
const server = http.createServer(app);

// Configure Socket.IO
const io = new Server(server);

// Web application port
const WEB_PORT = 3000;
// C server address and port
const C_SERVER_HOST = '127.0.0.1';
const C_SERVER_PORT = 50213;

// Serve static files
app.use(express.static('public'));

// Map to maintain TCP connections for clients
const clientConnections = new Map();
// Track registration state for each client
const clientRegistrationStatus = new Map();
// Queue for pending messages (before registration completes)
const pendingMessages = new Map();
// Track usernames to socket IDs
const usernameToSocketId = new Map();

io.on('connection', (socket) => {
  console.log('Web user connected with ID:', socket.id);
  let tcpClient = null;
  let username = null;
  
  // Initialize message queue for this client
  pendingMessages.set(socket.id, []);

  // When a user registers from the frontend
  socket.on('register', (userData) => {
    console.log('Received registration request:', userData);
    username = userData.username;
    
    // Create TCP connection with C server
    tcpClient = new net.Socket();
    
    // Set registration status to pending
    clientRegistrationStatus.set(socket.id, 'pending');
    
    // Handle TCP connection errors
    tcpClient.on('error', (err) => {
      console.error('TCP connection error:', err.message);
      socket.emit('serverMessage', {
        respuesta: 'ERROR',
        razon: 'Error connecting to chat server: ' + err.message
      });
      
      // Try to reconnect after a delay
      setTimeout(() => {
        if (clientRegistrationStatus.get(socket.id) === 'pending') {
          console.log('Attempting to reconnect...');
          try {
            tcpClient.connect(C_SERVER_PORT, C_SERVER_HOST);
          } catch (e) {
            console.error('Reconnection attempt failed:', e);
          }
        }
      }, 3000);
    });
    
    tcpClient.connect(C_SERVER_PORT, C_SERVER_HOST, () => {
      console.log('Connected to C server');
      
      // Send registration message
      const registerMsg = {
        tipo: 'REGISTRO',
        usuario: userData.username,
        direccionIP: userData.ip || '127.0.0.1'
      };
      
      console.log('Sending registration:', JSON.stringify(registerMsg));
      tcpClient.write(JSON.stringify(registerMsg));
      
      // Associate username with socket ID
      usernameToSocketId.set(userData.username, socket.id);
    });
    
    // Variable to store message fragments
    let buffer = '';
    
    // Handle data received from C server
    tcpClient.on('data', (data) => {
      try {
        const dataStr = data.toString();
        console.log('Raw data received:', dataStr);
        buffer += dataStr;
        
        // Process complete JSON objects
        let jsonStart = 0;
        let jsonEnd = -1;
        
        // Look for complete JSON objects in buffer
        while ((jsonStart = buffer.indexOf('{', jsonStart)) !== -1) {
          // Find matching closing bracket
          let openBrackets = 0;
          let foundComplete = false;
          
          for (let i = jsonStart; i < buffer.length; i++) {
            if (buffer[i] === '{') openBrackets++;
            if (buffer[i] === '}') openBrackets--;
            
            if (openBrackets === 0) {
              jsonEnd = i + 1;
              foundComplete = true;
              break;
            }
          }
          
          if (!foundComplete) break; // No complete JSON object found
          
          // Try to parse the JSON object
          const jsonStr = buffer.substring(jsonStart, jsonEnd);
          try {
            const jsonObj = JSON.parse(jsonStr);
            console.log('Processed message from C server:', jsonObj);
            
            // Handle registration response
            if (clientRegistrationStatus.get(socket.id) === 'pending') {
              // Check for successful registration response
              if (jsonObj.respuesta === 'OK' || 
                jsonObj.respuesta === 'Registro exitoso' ||
                (jsonObj.tipo === 'REGISTRO' && !jsonObj.respuesta)) {
             
                // Registration successful
                clientRegistrationStatus.set(socket.id, 'registered');
                console.log('Registration successful for client:', socket.id);
                
                // Process any pending messages
                const queue = pendingMessages.get(socket.id) || [];
                if (queue.length > 0) {
                  console.log(`Processing ${queue.length} pending messages`);
                  queue.forEach(msg => {
                    tcpClient.write(JSON.stringify(msg));
                  });
                  pendingMessages.set(socket.id, []);
                }
                
                // Send standardized OK response to frontend
                socket.emit('serverMessage', {
                  respuesta: 'OK'
                });
              } else if (jsonObj.respuesta === 'ERROR' || jsonObj.razon) {
                // Registration failed
                clientRegistrationStatus.set(socket.id, 'failed');
                console.log('Registration failed:', jsonObj.razon);
                socket.emit('serverMessage', {
                  respuesta: 'ERROR',
                  razon: jsonObj.razon || 'Error de registro desconocido'
                });
              }
            }
            
            // Forward messages to frontend based on message type
            if (jsonObj.accion === 'BROADCAST') {
              // If it's a broadcast, send to all clients
              io.emit('serverMessage', jsonObj);
            } else if (jsonObj.accion === 'DM') {
              // If it's a DM, find the target client
              const targetSocketId = usernameToSocketId.get(jsonObj.nombre_destinatario);
              if (targetSocketId) {
                io.to(targetSocketId).emit('serverMessage', jsonObj);
              }
              // Also send to sender for confirmation
              const senderSocketId = usernameToSocketId.get(jsonObj.nombre_emisor);
              if (senderSocketId) {
                io.to(senderSocketId).emit('serverMessage', jsonObj);
              }
            } else if (jsonObj.accion === 'LISTA' || jsonObj.tipo === 'LISTA') {
              // Handle user list
              socket.emit('serverMessage', jsonObj);
            } else if (jsonObj.tipo === 'INFO_USUARIO' || jsonObj.tipo === 'MOSTRAR') {
              // User info response
              socket.emit('serverMessage', jsonObj);
            } else if (jsonObj.tipo === 'ESTADO') {
              // State update - just acknowledge
              socket.emit('serverMessage', {
                respuesta: 'OK',
                mensaje: 'Estado actualizado correctamente'
              });
            } else {
              // For any other message types, just forward to the client
              socket.emit('serverMessage', jsonObj);
            }
            
          } catch (parseError) {
            console.error('Error parsing JSON:', parseError, 'String:', jsonStr);
          }
          
          // Move to next position in buffer
          buffer = buffer.substring(jsonEnd);
          jsonStart = 0;
        }
      } catch (e) {
        console.error('Error processing data:', e);
        console.error('Data received:', data.toString());
      }
    });
    
    tcpClient.on('close', () => {
      console.log('Connection with C server closed');
      if (clientRegistrationStatus.get(socket.id) === 'registered') {
        clientRegistrationStatus.set(socket.id, 'disconnected');
        socket.emit('serverMessage', {
          respuesta: 'ERROR',
          razon: 'Connection with server closed'
        });
      }
    });
    
    // Save TCP connection associated with this socket
    clientConnections.set(socket.id, tcpClient);
  });
  
  // When a message is received from frontend
  socket.on('clientMessage', (message) => {
    console.log('Message from web client:', message);
    const tcpClient = clientConnections.get(socket.id);
    
    if (tcpClient) {
      const regStatus = clientRegistrationStatus.get(socket.id);
      
      if (regStatus === 'registered') {
        // Client is registered, send message immediately
        console.log('Sending to C server:', JSON.stringify(message));
        tcpClient.write(JSON.stringify(message));
      } else if (regStatus === 'pending') {
        // Registration is pending, queue the message
        console.log('Registration pending. Queueing message:', message);
        const queue = pendingMessages.get(socket.id) || [];
        queue.push(message);
        pendingMessages.set(socket.id, queue);
      } else {
        // Registration failed or disconnected
        console.error('Cannot send message - client not properly registered:', regStatus);
        socket.emit('serverMessage', {
          respuesta: 'ERROR',
          razon: 'You are not properly connected to the server. Please try re-connecting.'
        });
      }
    } else {
      console.error('No TCP connection for this client:', socket.id);
      socket.emit('serverMessage', {
        respuesta: 'ERROR',
        razon: 'You are not connected to the server'
      });
    }
  });
  
  // When web socket disconnects
  socket.on('disconnect', () => {
    console.log('Web user disconnected:', socket.id);
    const tcpClient = clientConnections.get(socket.id);
    
    // Remove username from map
    if (username) {
      usernameToSocketId.delete(username);
    }
    
    if (tcpClient) {
      // Send exit message before closing
      try {
        const exitMsg = {
          tipo: 'EXIT',
          usuario: username || 'disconnected_user'
        };
        tcpClient.write(JSON.stringify(exitMsg));
        
        // Wait a moment before closing the connection
        setTimeout(() => {
          tcpClient.end();
          clientConnections.delete(socket.id);
          clientRegistrationStatus.delete(socket.id);
          pendingMessages.delete(socket.id);
        }, 500);
      } catch (err) {
        console.error('Error closing TCP connection:', err);
        tcpClient.destroy();
        clientConnections.delete(socket.id);
        clientRegistrationStatus.delete(socket.id);
        pendingMessages.delete(socket.id);
      }
    }
  });
});

// Middleware to handle errors
app.use((err, req, res, next) => {
  console.error('Error in Express server:', err.stack);
  res.status(500).send('Internal server error');
});

// Start the server
server.listen(WEB_PORT, () => {
  console.log(`Web server listening at http://localhost:${WEB_PORT}`);
});

// Handle closing signals
process.on('SIGINT', () => {
  console.log('Closing server...');
  
  // Close all TCP connections
  for (const [id, client] of clientConnections.entries()) {
    try {
      client.end();
    } catch (e) {
      console.error(`Error closing client ${id}:`, e);
    }
  }
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});