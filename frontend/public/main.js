document.addEventListener('DOMContentLoaded', function() {
    // UI Elements
    const loginScreen = document.getElementById('login-screen');
    const chatScreen = document.getElementById('chat-screen');
    const usernameInput = document.getElementById('username');
    const serverIpInput = document.getElementById('server-ip');
    const loginBtn = document.getElementById('login-btn');
    const currentUserDisplay = document.getElementById('current-user');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const chatArea = document.getElementById('chat-area');
    const userList = document.getElementById('user-list');
    const statusSelect = document.getElementById('status-select');
    const updateStatusBtn = document.getElementById('update-status-btn');
    const refreshUsersBtn = document.getElementById('refresh-users-btn');

    // Socket.io connection
    const socket = io();
    let currentUser = null;
    let isConnected = false;

    // Connection status tracker
    let connectionStatus = 'disconnected'; // 'disconnected', 'connecting', 'connected'

    // Login screen handling
    loginBtn.addEventListener('click', function() {
        const username = usernameInput.value.trim();
        const serverIp = serverIpInput.value.trim() || '127.0.0.1';
        
        if (username) {
            connectionStatus = 'connecting';
            
            // Show spinner or loading indication
            loginBtn.textContent = 'Conectando...';
            loginBtn.disabled = true;
            
            addSystemMessage('Conectando al servidor...');
            
            // Emit register event
            socket.emit('register', {
                username: username,
                ip: serverIp
            });
            
            currentUser = username;
        } else {
            addSystemMessage('Por favor ingresa un nombre de usuario válido');
        }
    });

    // Handle server messages
    socket.on('serverMessage', function(data) {
        console.log('Received server message:', data);
        
        // Handle registration or error responses
        if (data.respuesta !== undefined) {
            if (connectionStatus === 'connecting') {
                if (data.respuesta === 'OK') {
                    // Registration successful
                    console.log('Registration successful, switching to chat screen');
                    connectionStatus = 'connected';
                    isConnected = true;
                    
                    // Switch to chat screen
                    loginScreen.classList.add('hidden');
                    chatScreen.classList.remove('hidden');
                    
                    // Set current user display
                    currentUserDisplay.textContent = currentUser;
                    
                    // Welcome message with available commands
                    addSystemMessage(`Bienvenido al chat, ${currentUser}!`);
                    addSystemMessage("=== Comandos disponibles: /BROADCAST, /DM, /LISTA, /ESTADO, /MOSTRAR, /AYUDA, /EXIT ===");
                    
                    // Request user list after successful login
                    setTimeout(() => {
                        if (isConnected) {
                            requestUserList();
                        }
                    }, 500);
                } else if (data.respuesta === 'ERROR') {
                    // Registration failed
                    connectionStatus = 'disconnected';
                    loginBtn.textContent = 'Conectar';
                    loginBtn.disabled = false;
                    
                    addSystemMessage(`Error: ${data.razon || 'Error desconocido'}`);
                }
            } else if (data.respuesta === 'ERROR') {
                // Error message while connected
                addSystemMessage(`Error: ${data.razon || 'Error desconocido'}`);
            } else if (data.mensaje) {
                // General message
                addSystemMessage(data.mensaje);
            }
        }
        
        // Handle action messages (chat, etc.)
        if (data.accion) {
            switch(data.accion) {
                case 'BROADCAST':
                    // Skip messages from self as they're already displayed
                    if (data.nombre_emisor !== currentUser) {
                        addChatMessage(data.nombre_emisor, data.mensaje, 'broadcast');
                    }
                    break;
                case 'DM':
                    // Only show DMs if you're the sender or recipient
                    if (data.nombre_emisor !== currentUser && data.nombre_destinatario === currentUser) {
                        addChatMessage(data.nombre_emisor, data.mensaje, 'direct');
                    }
                    break;
                case 'LISTA':
                    if (data.usuarios) {
                        updateUserList(data.usuarios);
                    }
                    break;
            }
        }
        
        // Handle type-specific messages
        if (data.tipo) {
            switch(data.tipo) {
                case 'LISTA':
                    if (data.usuarios) {
                        updateUserList(data.usuarios);
                    }
                    break;
                case 'MOSTRAR':
                case 'INFO_USUARIO':
                    if (data.usuario) {
                        const userInfo = `Usuario: ${data.usuario}\nEstado: ${data.estado || 'ACTIVO'}\nIP: ${data.direccionIP || 'No disponible'}`;
                        addSystemMessage(userInfo);
                    }
                    break;
                case 'ESTADO':
                    addSystemMessage(`Estado actualizado a: ${data.estado}`);
                    break;
            }
        }
    });

    // Send message handling
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    function sendMessage() {
        if (!isConnected) {
            addSystemMessage('No estás conectado al servidor');
            return;
        }
        
        const message = messageInput.value.trim();
        if (!message) return;
        
        if (message.startsWith('/')) {
            // Handle commands
            if (message.startsWith('/BROADCAST ')) {
                const broadcastMsg = message.substring(11);
                socket.emit('clientMessage', {
                    accion: 'BROADCAST',
                    nombre_emisor: currentUser,
                    mensaje: broadcastMsg
                });
                // Add sent message to chat (client-side acknowledgment)
                addChatMessage(currentUser, broadcastMsg, 'sent');
            } else if (message.startsWith('/DM ')) {
                const parts = message.substring(4).split(' ');
                if (parts.length < 2) {
                    addSystemMessage('Formato incorrecto. Uso: /DM <usuario> <mensaje>');
                    return;
                }
                
                const recipient = parts[0];
                const dmMessage = parts.slice(1).join(' ');
                
                socket.emit('clientMessage', {
                    accion: 'DM',
                    nombre_emisor: currentUser,
                    nombre_destinatario: recipient,
                    mensaje: dmMessage
                });
                
                // Add sent message to chat (client-side acknowledgment)
                addChatMessage(currentUser, `(DM para ${recipient}): ${dmMessage}`, 'sent');
            } else if (message === '/LISTA') {
                requestUserList();
            } else if (message.startsWith('/ESTADO ')) {
                const newStatus = message.substring(8);
                if (!['ACTIVO', 'OCUPADO', 'INACTIVO'].includes(newStatus)) {
                    addSystemMessage('Estado inválido. Use ACTIVO, OCUPADO o INACTIVO.');
                    return;
                }
                
                socket.emit('clientMessage', {
                    tipo: 'ESTADO',
                    usuario: currentUser,
                    estado: newStatus
                });
                
                addSystemMessage(`Cambiando estado a: ${newStatus}`);
            } else if (message.startsWith('/MOSTRAR ')) {
                const userToShow = message.substring(9);
                socket.emit('clientMessage', {
                    tipo: 'MOSTRAR',
                    usuario: userToShow
                });
            } else if (message === '/AYUDA') {
                addSystemMessage("=== COMANDOS DISPONIBLES ===");
                addSystemMessage("/BROADCAST <mensaje> - Envía un mensaje a todos");
                addSystemMessage("/DM <usuario> <mensaje> - Envía un mensaje privado");
                addSystemMessage("/LISTA - Muestra la lista de usuarios");
                addSystemMessage("/ESTADO <estado> - Cambia tu estado (ACTIVO, OCUPADO, INACTIVO)");
                addSystemMessage("/MOSTRAR <usuario> - Muestra información de un usuario");
                addSystemMessage("/AYUDA - Muestra esta ayuda");
                addSystemMessage("/EXIT - Salir del chat");
            } else if (message === '/EXIT') {
                socket.emit('clientMessage', {
                    tipo: 'EXIT',
                    usuario: currentUser,
                    estado: ''
                });
                
                // Go back to login screen
                chatScreen.classList.add('hidden');
                loginScreen.classList.remove('hidden');
                isConnected = false;
                connectionStatus = 'disconnected';
                loginBtn.textContent = 'Conectar';
                loginBtn.disabled = false;
                
                addSystemMessage("Has salido del chat");
            } else {
                addSystemMessage('Comando desconocido. Usa /AYUDA para ver los comandos disponibles.');
            }
        } else {
            // Regular message - send as BROADCAST
            socket.emit('clientMessage', {
                accion: 'BROADCAST',
                nombre_emisor: currentUser,
                mensaje: message
            });
            
            // Add the sent message to the chat
            addChatMessage(currentUser, message, 'sent');
        }
        
        messageInput.value = '';
    }

    // Update user status
    updateStatusBtn.addEventListener('click', function() {
        if (!isConnected) return;
        
        const newStatus = statusSelect.value;
        // Map frontend status to server status codes
        const statusMap = {
            'ONLINE': 'ACTIVO',
            'AWAY': 'INACTIVO',
            'BUSY': 'OCUPADO'
        };
        
        const cStatus = statusMap[newStatus] || newStatus;
        
        socket.emit('clientMessage', {
            tipo: 'ESTADO',
            usuario: currentUser,
            estado: cStatus
        });
        
        addSystemMessage(`Cambiando estado a: ${newStatus}`);
    });

    // Refresh user list
    refreshUsersBtn.addEventListener('click', requestUserList);

    function requestUserList() {
        if (!isConnected) {
            addSystemMessage('No estás conectado al servidor');
            return;
        }
        
        socket.emit('clientMessage', {
            accion: 'LISTA',
            nombre_usuario: currentUser
        });
        
        addSystemMessage("Solicitando lista de usuarios...");
    }

    // Helper functions
    function addSystemMessage(message) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'system-message';
        
        // Handle multi-line messages (like from /AYUDA)
        if (message.includes('\n')) {
            const lines = message.split('\n');
            lines.forEach(line => {
                const lineSpan = document.createElement('div');
                lineSpan.textContent = line;
                msgDiv.appendChild(lineSpan);
            });
        } else {
            msgDiv.textContent = message;
        }
        
        // Make sure chatArea exists before appending
        if (chatArea) {
            chatArea.appendChild(msgDiv);
            chatArea.scrollTop = chatArea.scrollHeight;
        } else {
            console.error('Chat area element not found');
        }
    }

    function addChatMessage(sender, message, type) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${type}`;
        
        const senderSpan = document.createElement('span');
        senderSpan.className = 'sender';
        senderSpan.textContent = sender + ': ';
        
        const contentSpan = document.createElement('span');
        contentSpan.className = 'content';
        contentSpan.textContent = message;
        
        msgDiv.appendChild(senderSpan);
        msgDiv.appendChild(contentSpan);
        chatArea.appendChild(msgDiv);
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    function updateUserList(users) {
        userList.innerHTML = '';
        
        console.log('Updating user list with data:', users);
        
        if (Array.isArray(users)) {
            users.forEach(user => {
                addUserToList(user);
            });
        } else if (typeof users === 'object' && users !== null) {
            // Handle case where users might be an object instead of array
            Object.keys(users).forEach(key => {
                const userData = users[key];
                addUserToList(userData);
            });
        } else {
            addSystemMessage('Error al obtener lista de usuarios');
        }
    }

    function addUserToList(user) {
        let username, status;
        
        // Handle different user data formats
        if (typeof user === 'string') {
            username = user;
            status = 'ACTIVO'; // Default status
        } else if (user.nombre) {
            username = user.nombre;
            status = user.estado || 'ACTIVO';
        } else if (user.usuario) {
            username = user.usuario;
            status = user.estado || 'ACTIVO';
        } else if (user.name) {
            username = user.name;
            status = user.status || 'ACTIVO';
        } else {
            console.log('Formato de usuario no reconocido:', user);
            return; // Skip invalid user format
        }
        
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.textContent = `${username} [${status}]`;
        
        // Add click event to initiate DM
        userItem.addEventListener('click', function() {
            messageInput.value = `/DM ${username} `;
            messageInput.focus();
        });
        
        userList.appendChild(userItem);
    }

    // Connection status handling
    socket.on('connect', function() {
        console.log('Socket connected');
    });

    socket.on('disconnect', function() {
        console.log('Socket disconnected');
        isConnected = false;
        connectionStatus = 'disconnected';
        
        // Show error message and return to login screen
        addSystemMessage('Desconectado del servidor');
        
        // Go back to login screen
        chatScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        loginBtn.textContent = 'Conectar';
        loginBtn.disabled = false;
    });
});