// main.js - Client-side script
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
        
        if (data.respuesta) {
            // Registration or command response
            if (connectionStatus === 'connecting' && data.respuesta === 'OK') {
                // Registration successful
                connectionStatus = 'connected';
                isConnected = true;
                
                // Switch to chat screen
                loginScreen.classList.add('hidden');
                chatScreen.classList.remove('hidden');
                
                // Set current user display
                currentUserDisplay.textContent = currentUser;
                
                // Request user list after successful login
                setTimeout(() => {
                    if (isConnected) {
                        requestUserList();
                    }
                }, 500);
                
                addSystemMessage(`Bienvenido al chat, ${currentUser}!`);
            } else if (connectionStatus === 'connecting' && data.respuesta === 'ERROR') {
                // Registration failed
                connectionStatus = 'disconnected';
                loginBtn.textContent = 'Conectar';
                loginBtn.disabled = false;
                
                addSystemMessage(`Error al conectar: ${data.razon || 'Error desconocido'}`);
            }
        } else if (data.accion) {
            // Chat actions
            switch(data.accion) {
                case 'BROADCAST':
                    addChatMessage(data.nombre_emisor, data.mensaje, 'broadcast');
                    break;
                case 'DM':
                    addChatMessage(data.nombre_emisor, data.mensaje, 'direct');
                    break;
                case 'LISTA':
                    updateUserList(data.usuarios);
                    break;
            }
        } else if (data.tipo) {
            // Special messages
            switch(data.tipo) {
                case 'MOSTRAR':
                    const userInfo = `Usuario: ${data.usuario}\nEstado: ${data.estado}\nIP: ${data.direccionIP}`;
                    addSystemMessage(userInfo);
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
            } else if (message.startsWith('/DM ')) {
                const parts = message.substring(4).split(' ');
                const recipient = parts[0];
                const dmMessage = parts.slice(1).join(' ');
                
                socket.emit('clientMessage', {
                    accion: 'DM',
                    nombre_emisor: currentUser,
                    nombre_destinatario: recipient,
                    mensaje: dmMessage
                });
            } else if (message.startsWith('/LISTA')) {
                requestUserList();
            } else if (message.startsWith('/ESTADO ')) {
                const newStatus = message.substring(8);
                socket.emit('clientMessage', {
                    tipo: 'ESTADO',
                    usuario: currentUser,
                    estado: newStatus
                });
            } else if (message.startsWith('/MOSTRAR ')) {
                const userToShow = message.substring(9);
                socket.emit('clientMessage', {
                    tipo: 'MOSTRAR',
                    usuario: userToShow
                });
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
            } else {
                addSystemMessage('Comando desconocido');
            }
        } else {
            // Regular message
            socket.emit('clientMessage', {
                tipo: 'MENSAJE',
                usuario: currentUser,
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
        socket.emit('clientMessage', {
            tipo: 'ESTADO',
            usuario: currentUser,
            estado: newStatus
        });
        
        addSystemMessage(`Cambiando estado a: ${newStatus}`);
    });

    // Refresh user list
    refreshUsersBtn.addEventListener('click', requestUserList);

    function requestUserList() {
        if (!isConnected) return;
        
        socket.emit('clientMessage', {
            accion: 'LISTA',
            nombre_usuario: currentUser
        });
    }

    // Helper functions
    function addSystemMessage(message) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'system-message';
        msgDiv.textContent = message;
        chatArea.appendChild(msgDiv);
        chatArea.scrollTop = chatArea.scrollHeight;
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
        
        if (Array.isArray(users)) {
            users.forEach(username => {
                const userItem = document.createElement('div');
                userItem.className = 'user-item';
                userItem.textContent = username;
                
                // Add click event to initiate DM
                userItem.addEventListener('click', function() {
                    messageInput.value = `/DM ${username} `;
                    messageInput.focus();
                });
                
                userList.appendChild(userItem);
            });
        } else {
            addSystemMessage('Error al obtener lista de usuarios');
        }
    }

    // Connection status handling
    socket.on('connect', function() {
        console.log('Socket connected');
    });

    socket.on('disconnect', function() {
        console.log('Socket disconnected');
        isConnected = false;
        connectionStatus = 'disconnected';
        
        // If we were in chat screen, show error
        if (!loginScreen.classList.contains('hidden')) {
            addSystemMessage('Desconectado del servidor');
        }
    });
});