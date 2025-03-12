const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const net = require('net');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Enable CORS
app.use(cors());

// Configure Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

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

io.on('connection', (socket) => {
  console.log('Web user connected with ID:', socket.id);
  let tcpClient = null;
  
  // Initialize message queue for this client
  pendingMessages.set(socket.id, []);

  // When a user registers from the frontend
  socket.on('register', (userData) => {
    console.log('Received registration request:', userData);
    
    // Create TCP connection with C server
    tcpClient = new net.Socket();
    
    // Set registration status to pending
    clientRegistrationStatus.set(socket.id, 'pending');
    
    tcpClient.connect(C_SERVER_PORT, C_SERVER_HOST, () => {
      console.log('Connected to C server');
      
      // Send registration message
      const registerMsg = {
        tipo: 'REGISTRO',
        usuario: userData.username,
        direccionIP: userData.ip || '127.0.0.1'
      };
      
      console.log('Sending registration:', JSON.stringify(registerMsg));
      tcpClient.write(JSON.stringify(registerMsg) + '\n'); // Add newline for message separation
    });
    
    // Variable to store message fragments
    let buffer = '';
    
    // Handle data received from C server
    tcpClient.on('data', (data) => {
      try {
        buffer += data.toString();
        
        // Process complete JSON messages
        let startPos = 0;
        let endPos = buffer.indexOf('}', startPos);
        
        while (endPos !== -1) {
          const jsonStr = buffer.substring(startPos, endPos + 1);
          
          try {
            const jsonObj = JSON.parse(jsonStr);
            console.log('Message from C server:', jsonObj);
            
            // Check if this is a registration response
            if (jsonObj.respuesta && clientRegistrationStatus.get(socket.id) === 'pending') {
              if (jsonObj.respuesta === 'OK') {
                // Registration successful
                clientRegistrationStatus.set(socket.id, 'registered');
                console.log('Registration successful for client:', socket.id);
                
                // Process any pending messages
                const queue = pendingMessages.get(socket.id) || [];
                if (queue.length > 0) {
                  console.log(`Processing ${queue.length} pending messages for ${socket.id}`);
                  queue.forEach(msg => {
                    const messageStr = JSON.stringify(msg) + '\n';
                    console.log('Sending pending message to C server:', messageStr);
                    tcpClient.write(messageStr);
                  });
                  pendingMessages.set(socket.id, []);
                }
              } else {
                // Registration failed
                clientRegistrationStatus.set(socket.id, 'failed');
                console.log('Registration failed for client:', socket.id);
              }
            }
            
            socket.emit('serverMessage', jsonObj);
          } catch (e) {
            console.error('Error parsing JSON:', e);
          }
          
          startPos = endPos + 1;
          // Skip whitespace and new lines
          while (startPos < buffer.length && (buffer[startPos] === ' ' || buffer[startPos] === '\n' || buffer[startPos] === '\r')) {
            startPos++;
          }
          
          endPos = buffer.indexOf('}', startPos);
        }
        
        // Keep remaining data for next processing
        if (startPos < buffer.length) {
          buffer = buffer.substring(startPos);
        } else {
          buffer = '';
        }
      } catch (e) {
        console.error('Error processing data:', e);
        console.error('Data received:', data.toString());
      }
    });
    
    // Handle errors and connection close
    tcpClient.on('error', (err) => {
      console.error('Error in TCP connection:', err);
      clientRegistrationStatus.set(socket.id, 'failed');
      socket.emit('serverMessage', {
        respuesta: 'ERROR',
        razon: 'Connection error with server: ' + err.message
      });
    });
    
    tcpClient.on('close', () => {
      console.log('Connection with C server closed');
      clientRegistrationStatus.set(socket.id, 'disconnected');
      socket.emit('serverMessage', {
        respuesta: 'ERROR',
        razon: 'Connection with server closed'
      });
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
        const messageStr = JSON.stringify(message) + '\n'; // Add newline for message separation
        console.log('Sending to C server:', messageStr);
        tcpClient.write(messageStr);
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
    if (tcpClient) {
      // Send exit message before closing
      try {
        const exitMsg = {
          tipo: 'EXIT',
          usuario: 'disconnected_user'
        };
        tcpClient.write(JSON.stringify(exitMsg) + '\n');
        
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