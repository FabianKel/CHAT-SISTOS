// Variables globales
let socket;
let username = '';
let serverIP = '';
let serverPort = '';
let connected = false;
let userList = [];

// Elementos DOM
const loginSection = document.getElementById('login-section');
const chatSection = document.getElementById('chat-section');
const usernameInput = document.getElementById('username');
const serverIPInput = document.getElementById('server-ip');
const serverPortInput = document.getElementById('server-port');
const loginBtn = document.getElementById('login-btn');
const currentUsernameDisplay = document.getElementById('current-username');
const userListElement = document.getElementById('user-list');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

// Inicializar la interfaz
document.addEventListener('DOMContentLoaded', function() {
    chatSection.style.display = 'none';
    
    // Eventos de botones
    loginBtn.addEventListener('click', conectarAlServidor);
    sendBtn.addEventListener('click', enviarMensaje);
    
    // Permitir enviar con Enter
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            enviarMensaje();
        }
    });

    // Verificar si el proxy WebSocket está en ejecución
    checkProxyConnection();
});

// Verificar si el proxy está disponible
function checkProxyConnection() {
    const testSocket = new WebSocket(`ws://127.0.0.1:50213`);
    
    // Establecer tiempo límite para la conexión
    const timeout = setTimeout(() => {
        testSocket.close();
        mostrarError('El servidor proxy WebSocket no está en ejecución. Ejecuta "node websocket-proxy.js" antes de usar la aplicación.');
    }, 3000);
    
    testSocket.onopen = function() {
        clearTimeout(timeout);
        testSocket.close();
        console.log("Proxy WebSocket disponible");
    };
    
    testSocket.onerror = function() {
        clearTimeout(timeout);
        mostrarError('No se pudo conectar al proxy WebSocket. Ejecuta "node websocket-proxy.js" antes de usar la aplicación.');
    };
}

function conectarAlServidor() {
    username = usernameInput.value.trim();
    serverIP = serverIPInput.value.trim();
    serverPort = serverPortInput.value.trim();
    
    if (!username) {
        mostrarError('Por favor ingresa un nombre de usuario');
        return;
    }
    
    if (!serverIP) {
        serverIP = '127.0.0.1';  // Valor por defecto
    }
    
    if (!serverPort) {
        serverPort = '50213';    // Valor por defecto
    }
    
    // Verificar si ya existe una conexión activa
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
    
    // Crear conexión WebSocket
    try {
        // Siempre usamos el proxy WebSocket local
        const wsUrl = `ws://127.0.0.1:50213`;
        console.log("Intentando conectar a:", wsUrl);
        
        socket = new WebSocket(wsUrl);
        
        socket.onopen = function() {
            console.log("Conectado al servidor WebSocket");
            enviarRegistro();
        };

        socket.onmessage = function(event) {
            console.log("Mensaje recibido:", event.data);
            procesarMensaje(event.data);
        };
        
        socket.onclose = function(event) {
            console.log("Desconectado del servidor", event);
            if (!connected) {
                mostrarError('No se pudo conectar al servidor. Comprueba que el proxy WebSocket esté en ejecución.');
            } else {
                mostrarError('Conexión cerrada');
                volverALogin();
            }
        };
        
        socket.onerror = function(error) {
            console.error("Error en la conexión WebSocket:", error);
            mostrarError('Error en la conexión. Asegúrate de que el proxy esté en ejecución.');
        };
    } catch (error) {
        console.error("Error al crear conexión WebSocket:", error);
        mostrarError('No se pudo establecer la conexión: ' + error.message);
    }
}

// Enviar registro al servidor
function enviarRegistro() {
    const registroMsg = {
        tipo: "REGISTRO",
        usuario: username,
        direccionIP: serverIP
    };
    
    enviarJSON(registroMsg);
}

// Procesar mensaje recibido del servidor
function procesarMensaje(data) {
    try {
        const mensaje = JSON.parse(data);
        console.log("Mensaje procesado:", mensaje);
        
        // Verificar tipo de mensaje
        if (mensaje.respuesta === "OK" || 
            mensaje.respuesta === "Registro exitoso" || 
            mensaje.tipo === "REGISTRO_EXITOSO") {
            // Registro exitoso
            iniciarChat();
            
            // Solicitar lista de usuarios tras iniciar sesión correctamente
            const listaMsg = {
                accion: "LISTA",
                nombre_usuario: username
            };
            enviarJSON(listaMsg);
            
        } else if (mensaje.tipo === "LISTA" || mensaje.accion === "LISTA") {
            // Actualizar lista de usuarios
            if (mensaje.usuarios) {
                actualizarListaUsuarios(mensaje.usuarios);
            } else {
                console.warn("Respuesta LISTA sin usuarios", mensaje);
            }
        } else if (mensaje.accion === "BROADCAST" || mensaje.tipo === "MENSAJE") {
            // Mensaje broadcast o normal
            mostrarMensajeEnChat(mensaje);
        } else if (mensaje.accion === "DM") {
            // Mensaje directo
            mostrarMensajePrivado(mensaje);
        } else if (mensaje.respuesta === "ERROR") {
            // Error del servidor
            mostrarError(mensaje.razon || "Error del servidor");
        } else {
            console.log("Mensaje no manejado:", mensaje);
            // Para debugging, mostrar mensajes desconocidos en el chat
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('message', 'system-message');
            messageDiv.innerHTML = `
                <div class="message-header">
                    <span class="message-sender">Sistema</span>
                    <span class="message-time">${obtenerHoraActual()}</span>
                </div>
                <div class="message-content">Mensaje recibido: ${JSON.stringify(mensaje)}</div>
            `;
            messagesContainer.appendChild(messageDiv);
            scrollToBottom();
        }
    } catch (error) {
        console.error("Error al procesar mensaje:", error, "Datos recibidos:", data);
        mostrarError("Error al procesar respuesta del servidor");
    }
}
// Mostrar mensaje en el chat
function mostrarMensajeEnChat(mensaje) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    
    // Determinar emisor y mensaje según formato
    let emisor = mensaje.nombre_emisor || mensaje.usuario || 'Servidor';
    let contenido = mensaje.mensaje || '';
    
    if (emisor === username) {
        messageDiv.classList.add('own-message');
    } else {
        messageDiv.classList.add('other-message');
    }
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="message-sender">${emisor}</span>
            <span class="message-time">${obtenerHoraActual()}</span>
        </div>
        <div class="message-content">${contenido}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

// Mostrar mensaje privado
function mostrarMensajePrivado(mensaje) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add('private-message');
    
    const emisor = mensaje.nombre_emisor || 'Desconocido';
    const destinatario = mensaje.nombre_destinatario || 'Desconocido';
    const esPropio = emisor === username;
    
    if (esPropio) {
        messageDiv.classList.add('own-message');
    } else {
        messageDiv.classList.add('other-message');
    }
    
    const headerText = esPropio ? 
        `Mensaje privado para ${destinatario}` : 
        `Mensaje privado de ${emisor}`;
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="message-sender">${headerText}</span>
            <span class="message-time">${obtenerHoraActual()}</span>
        </div>
        <div class="message-content">${mensaje.mensaje}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

// Actualizar lista de usuarios
function actualizarListaUsuarios(usuarios) {
    if (!Array.isArray(usuarios)) {
        console.error("Lista de usuarios no es un array:", usuarios);
        return;
    }
    
    userList = usuarios;
    userListElement.innerHTML = '';
    
    usuarios.forEach(usuario => {
        const userItem = document.createElement('li');
        userItem.classList.add('user-item');
        
        // Si el objeto tiene estructura anidada o es string
        const nombreUsuario = typeof usuario === 'object' ? usuario.nombre : usuario;
        const estado = typeof usuario === 'object' && usuario.estado ? usuario.estado : 'En línea';
        
        const isCurrentUser = nombreUsuario === username;
        
        if (isCurrentUser) {
            userItem.classList.add('current-user');
        }
        
        userItem.innerHTML = `
            <div class="user-status">
                <div class="status-dot ${estado === 'En línea' ? 'online' : 'offline'}"></div>
                <span class="user-name">${nombreUsuario} ${isCurrentUser ? '(Tú)' : ''}</span>
            </div>
            <div class="user-state">${estado}</div>
        `;
        
        userItem.addEventListener('click', () => {
            if (!isCurrentUser) {
                iniciarMensajePrivado(nombreUsuario);
            }
        });
        
        userListElement.appendChild(userItem);
    });
}

// Iniciar mensaje privado
function iniciarMensajePrivado(destinatario) {
    messageInput.value = `/DM ${destinatario} `;
    messageInput.focus();
}

// Enviar mensaje
function enviarMensaje() {
    const mensaje = messageInput.value.trim();
    
    if (!mensaje) {
        return;
    }
    
    // Verificar si es un comando
    if (mensaje.startsWith('/')) {
        procesarComando(mensaje);
    } else {
        // Mensaje normal (broadcast)
        const mensajeObj = {
            tipo: "MENSAJE",
            usuario: username,
            mensaje: mensaje
        };
        
        enviarJSON(mensajeObj);
        
        // También mostramos localmente mientras esperamos confirmación
        mostrarMensajeEnChat({
            usuario: username,
            mensaje: mensaje
        });
    }
    
    messageInput.value = '';
}

// Procesar comandos
function procesarComando(comando) {
    const partesMensaje = comando.split(' ');
    const nombreComando = partesMensaje[0].toUpperCase();
    
    // Descomponer el comando
    if (nombreComando === '/DM') {
        // Mensaje directo
        if (partesMensaje.length < 3) {
            mostrarError('Formato correcto: /DM usuario mensaje');
            return;
        }
        
        const destinatario = partesMensaje[1];
        const mensaje = partesMensaje.slice(2).join(' ');
        
        const mensajeObj = {
            accion: "DM",
            nombre_emisor: username,
            nombre_destinatario: destinatario,
            mensaje: mensaje
        };
        
        enviarJSON(mensajeObj);
        
        // También mostramos localmente
        mostrarMensajePrivado({
            nombre_emisor: username,
            nombre_destinatario: destinatario,
            mensaje: mensaje
        });
    } else if (nombreComando === '/BROADCAST') {
        // Broadcast
        const mensaje = partesMensaje.slice(1).join(' ');
        
        if (!mensaje) {
            mostrarError('Formato correcto: /BROADCAST mensaje');
            return;
        }
        
        const mensajeObj = {
            accion: "BROADCAST",
            nombre_emisor: username,
            mensaje: mensaje
        };
        
        enviarJSON(mensajeObj);
    } else if (nombreComando === '/LISTA') {
        // Solicitar lista de usuarios
        const mensajeObj = {
            accion: "LISTA",
            nombre_usuario: username
        };
        
        enviarJSON(mensajeObj);
        mostrarNotificacion("Solicitando lista de usuarios...");
    } else if (nombreComando === '/ESTADO') {
        // Cambiar estado
        const estado = partesMensaje.slice(1).join(' ');
        
        if (!estado) {
            mostrarError('Formato correcto: /ESTADO [estado]');
            return;
        }
        
        const mensajeObj = {
            tipo: "ESTADO",
            usuario: username,
            estado: estado
        };
        
        enviarJSON(mensajeObj);
        mostrarNotificacion(`Cambiando estado a: ${estado}`);
    } else if (nombreComando === '/MOSTRAR') {
        // Mostrar información de usuario
        const usuario = partesMensaje[1];
        
        if (!usuario) {
            mostrarError('Formato correcto: /MOSTRAR usuario');
            return;
        }
        
        const mensajeObj = {
            tipo: "MOSTRAR",
            usuario: usuario
        };
        
        enviarJSON(mensajeObj);
        mostrarNotificacion(`Solicitando información del usuario: ${usuario}`);
    } else if (nombreComando === '/EXIT') {
        // Salir
        const mensajeObj = {
            tipo: "EXIT",
            usuario: username,
            estado: ""
        };
        
        enviarJSON(mensajeObj);
        mostrarNotificacion("Cerrando sesión...");
        
        setTimeout(() => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
            volverALogin();
        }, 1000);
    } else {
        mostrarError('Comando desconocido: ' + nombreComando);
    }
}

// Mostrar notificación en el chat
function mostrarNotificacion(mensaje) {
    const notifTemplate = document.getElementById('notification-template');
    const notifClone = document.importNode(notifTemplate.content, true);
    
    notifClone.querySelector('.notification-content').textContent = mensaje;
    notifClone.querySelector('.notification-time').textContent = obtenerHoraActual();
    
    messagesContainer.appendChild(notifClone);
    scrollToBottom();
}

// Funciones auxiliares
function iniciarChat() {
    connected = true;
    loginSection.style.display = 'none';
    chatSection.style.display = 'flex';
    currentUsernameDisplay.textContent = username;
    
    mostrarNotificacion(`Bienvenido al chat, ${username}`);
}

function volverALogin() {
    connected = false;
    chatSection.style.display = 'none';
    loginSection.style.display = 'block';
    messagesContainer.innerHTML = '';
    userListElement.innerHTML = '';
    messageInput.value = '';
}

function enviarJSON(obj) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        mostrarError('No hay conexión con el servidor');
        return false;
    }
    
    try {
        const jsonStr = JSON.stringify(obj);
        console.log("Enviando:", jsonStr);
        socket.send(jsonStr);
        return true;
    } catch (error) {
        console.error("Error al enviar mensaje:", error);
        return false;
    }
}

function mostrarError(mensaje) {
    console.error("ERROR:", mensaje);
    
    const errorDiv = document.createElement('div');
    errorDiv.classList.add('error-message');
    errorDiv.textContent = mensaje;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.classList.add('fade-out');
        setTimeout(() => {
            if (errorDiv.parentNode) {
                document.body.removeChild(errorDiv);
            }
        }, 500);
    }, 3000);
}

function obtenerHoraActual() {
    const ahora = new Date();
    return ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}