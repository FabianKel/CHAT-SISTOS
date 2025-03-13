const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const net = require('net');

const app = express();
const server = http.createServer(app);

// Configure Socket.IO without CORS
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
    
    // Simple auto-reconnect
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
        buffer += data.toString();
        console.log('Raw data received:', buffer);
        
        // Process complete JSON messages
        let jsonMessages = [];
        
        // Try to extract complete JSON objects
        try {
          // Check if buffer contains complete JSON objects
          if (buffer.trim()) {
            // Try to find complete JSON objects
            let validJson = false;
            
            // First try - whole buffer as one JSON
            try {
              const parsed = JSON.parse(buffer);
              jsonMessages.push(parsed);
              buffer = '';
              validJson = true;
            } catch (e) {
              // Not a single valid JSON
            }
            
            // Second try - split by newlines
            if (!validJson) {
              const parts = buffer.split('\n').filter(part => part.trim());
              let newBuffer = '';
              
              for (const part of parts) {
                try {
                  const parsed = JSON.parse(part);
                  jsonMessages.push(parsed);
                } catch (e) {
                  // Not valid JSON, keep in buffer
                  newBuffer += part + '\n';
                }
              }
              
              buffer = newBuffer;
            }
          }
        } catch (e) {
          console.error('Error processing messages:', e);
        }
        
        // Process each extracted JSON message
        for (const jsonObj of jsonMessages) {
          console.log('Processed message from C server:', jsonObj);
          
          // Registration response handling
          if (clientRegistrationStatus.get(socket.id) === 'pending') {
            // Check for successful registration
            if (jsonObj.respuesta === 'OK' || 
                (jsonObj.tipo === 'REGISTRO' && !jsonObj.razon)) {
              
              // Registration successful
              clientRegistrationStatus.set(socket.id, 'registered');
              console.log('Registration successful for client:', socket.id);
              
              // Process any pending messages
              const queue = pendingMessages.get(socket.id) || [];
              if (queue.length > 0) {
                console.log(`Processing ${queue.length} pending messages for ${socket.id}`);
                queue.forEach(msg => {
                  tcpClient.write(JSON.stringify(msg));
                });
                pendingMessages.set(socket.id, []);
              }
              
              // Send standardized OK response to frontend
              socket.emit('serverMessage', {
                respuesta: 'OK'
              });
              
              continue; // Skip further processing for this message
            } else if (jsonObj.respuesta === 'ERROR' || jsonObj.razon) {
              // Registration failed
              clientRegistrationStatus.set(socket.id, 'failed');
              console.log('Registration failed for client:', socket.id);
              socket.emit('serverMessage', {
                respuesta: 'ERROR',
                razon: jsonObj.razon || 'Error de registro desconocido'
              });
              
              continue; // Skip further processing for this message
            }
          }
          
          // Forward message to the appropriate client
          // If this is a message to a specific user (DM), find that user's socket
          if (jsonObj.accion === 'DM' && jsonObj.nombre_destinatario) {
            const targetSocketId = usernameToSocketId.get(jsonObj.nombre_destinatario);
            if (targetSocketId) {
              io.to(targetSocketId).emit('serverMessage', jsonObj);
            }
          } else {
            // Otherwise, send to the current client
            socket.emit('serverMessage', jsonObj);
          }
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