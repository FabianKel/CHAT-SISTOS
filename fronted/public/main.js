document.addEventListener('DOMContentLoaded', () => {
    // Elementos del DOM
    const loginScreen = document.getElementById('login-screen');
    const chatScreen = document.getElementById('chat-screen');
    const usernameInput = document.getElementById('username');
    const serverIpInput = document.getElementById('server-ip');
    const loginBtn = document.getElementById('login-btn');
    const currentUserEl = document.getElementById('current-user');
    const statusSelect = document.getElementById('status-select');
    const updateStatusBtn = document.getElementById('update-status-btn');
    const userListEl = document.getElementById('user-list');
    const chatTitleEl = document.getElementById('chat-title');
    const chatAreaEl = document.getElementById('chat-area');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const refreshUsersBtn = document.getElementById('refresh-users-btn');
    
    // Variables globales
    let currentUsername = '';
    let selectedUser = null;
    let chatMode = 'broadcast'; // 'broadcast' o 'direct'
    
    // Conexión Socket.io
    const socket = io();
    
    // Eventos de la interfaz
    loginBtn.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        const serverIp = serverIpInput.value.trim() || '127.0.0.1';
        
        if (!username) {
            alert('Por favor ingresa un nombre de usuario');
            return;
        }
        
        // Guardar el nombre de usuario actual
        currentUsername = username;
        currentUserEl.textContent = username;
        
        // Registrar al usuario en el servidor
        socket.emit('register', { username, ip: serverIp });
        
        // Cambiar a la pantalla de chat
        loginScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        
        // Solicitar lista de usuarios
        requestUserList();
    });
    
    // Actualizar estado
    updateStatusBtn.addEventListener('click', () => {
        const newStatus = statusSelect.value;
        socket.emit('clientMessage', {
            tipo: 'ESTADO',
            usuario: currentUsername,
            estado: newStatus
        });
    });
    
    // Enviar mensaje
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // Refrescar lista de usuarios
    refreshUsersBtn.addEventListener('click', requestUserList);
    
    // Función para enviar mensaje
    function sendMessage() {
        const messageText = messageInput.value.trim();
        if (!messageText) return;
        
        let message;
        
        if (messageText.startsWith('/')) {
            // Comandos especiales
            if (messageText.startsWith('/EXIT')) {
                message = {
                    tipo: 'EXIT',
                    usuario: currentUsername
                };
            } else if (messageText.startsWith('/ESTADO ')) {
                const estado = messageText.substr(8).trim();
                message = {
                    tipo: 'ESTADO',
                    usuario: currentUsername,
                    estado: estado
                };
            } else if (messageText.startsWith('/MOSTRAR ')) {
                const usuario = messageText.substr(9).trim();
                message = {
                    tipo: 'MOSTRAR',
                    usuario: usuario
                };
            } else {
                addSystemMessage('Comando no reconocido');
                messageInput.value = '';
                return;
            }
        } else if (chatMode === 'broadcast') {
            // Mensaje de broadcast
            message = {
                accion: 'BROADCAST',
                nombre_emisor: currentUsername,
                mensaje: messageText
            };
            
            // Agregar mensaje a la interfaz
            addMessage({
                username: currentUsername,
                content: messageText,
                isSent: true
            });
        } else if (chatMode === 'direct' && selectedUser) {
            // Mensaje directo
            message = {
                accion: 'DM',
                nombre_emisor: currentUsername,
                nombre_destinatario: selectedUser,
                mensaje: messageText
            };
            
            // Agregar mensaje a la interfaz
            addMessage({
                username: currentUsername,
                content: messageText,
                isSent: true,
                isDirect: true
            });
        }
        
        // Enviar al servidor
        socket.emit('clientMessage', message);
        messageInput.value = '';
    }
    
    // Función para solicitar lista de usuarios
    function requestUserList() {
        socket.emit('clientMessage', {
            accion: 'LISTA',
            nombre_usuario: currentUsername
        });
    }
    
    // Función para agregar mensaje a la interfaz
    function addMessage(msg) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${msg.isSent ? 'sent' : 'received'}`;
        
        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';
        
        if (!msg.isSent) {
            const senderEl = document.createElement('div');
            senderEl.className = 'message-sender';
            senderEl.textContent = msg.username;
            contentEl.appendChild(senderEl);
        }
        
        const textEl = document.createElement('div');
        textEl.textContent = msg.content;
        contentEl.appendChild(textEl);
        
        const metaEl = document.createElement('div');
        metaEl.className = 'message-meta';
        const now = new Date();
        metaEl.textContent = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
        contentEl.appendChild(metaEl);
        
        messageEl.appendChild(contentEl);
        chatAreaEl.appendChild(messageEl);
        
        // Scroll al final
        chatAreaEl.scrollTop = chatAreaEl.scrollHeight;
    }
    
    // Función para agregar mensaje del sistema
    function addSystemMessage(text) {
        const messageEl = document.createElement('div');
        messageEl.className = 'system-message';
        messageEl.textContent = text;
        chatAreaEl.appendChild(messageEl);
        
        // Scroll al final
        chatAreaEl.scrollTop = chatAreaEl.scrollHeight;
    }
    
    // Función para actualizar la lista de usuarios
    function updateUserList(users) {
        userListEl.innerHTML = `
            <div class="user-item" data-user="broadcast">
                <div class="user-status online"></div>
                <div>Chat general (Broadcast)</div>
            </div>
        `;
        
        users.forEach(user => {
            if (user !== currentUsername) {
                const userEl = document.createElement('div');
                userEl.className = 'user-item';
                userEl.dataset.user = user;
                userEl.innerHTML = `
                    <div class="user-status online"></div>
                    <div>${user}</div>
                `;
                userListEl.appendChild(userEl);
            }
        });
        
        // Evento de clic para seleccionar usuario
        document.querySelectorAll('.user-item').forEach(el => {
            el.addEventListener('click', () => {
                // Deseleccionar todos
                document.querySelectorAll('.user-item').forEach(item => {
                    item.style.backgroundColor = '';
                });
                
                // Seleccionar el actual
                el.style.backgroundColor = '#e0e7f1';
                
                if (el.dataset.user === 'broadcast') {
                    chatMode = 'broadcast';
                    selectedUser = null;
                    chatTitleEl.textContent = 'Chat General';
                } else {
                    chatMode = 'direct';
                    selectedUser = el.dataset.user;
                    chatTitleEl.textContent = `Chat con ${selectedUser}`;
                }
                
                // Limpiar área de chat
                chatAreaEl.innerHTML = '';
                addSystemMessage(`Ahora estás en modo ${chatMode === 'broadcast' ? 'broadcast' : 'mensaje directo'}`);
            });
        });
    }
    
    // Eventos de Socket.io
    socket.on('serverMessage', (data) => {
        if (data.respuesta === 'ERROR') {
            addSystemMessage(`Error: ${data.razon}`);
            return;
        }
        
        if (data.accion === 'BROADCAST') {
            // Mensaje broadcast recibido
            if (data.nombre_emisor !== currentUsername) {
                addMessage({
                    username: data.nombre_emisor,
                    content: data.mensaje,
                    isSent: false
                });
            }
        } else if (data.accion === 'DM') {
            // Mensaje directo recibido
            addMessage({
                username: data.nombre_emisor,
                content: data.mensaje,
                isSent: false,
                isDirect: true
            });
        } else if (data.accion === 'LISTA') {
            // Lista de usuarios recibida
            if (data.usuarios && Array.isArray(data.usuarios)) {
                updateUserList(data.usuarios);
            }
        } else if (data.tipo === 'MOSTRAR') {
            // Información de usuario
            addSystemMessage(`Usuario: ${data.usuario} | Estado: ${data.estado} | IP: ${data.direccionIP}`);
        } else if (data.respuesta === 'OK') {
            // Confirmación de operación
            if (data.mensaje) {
                addSystemMessage(`Servidor: ${data.mensaje}`);
            }
        }
    });
    
    socket.on('connect_error', (error) => {
        addSystemMessage(`Error de conexión: ${error.message}`);
    });
    
    socket.on('disconnect', () => {
        addSystemMessage('Desconectado del servidor');
    });
});