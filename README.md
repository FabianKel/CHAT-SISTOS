# **CHAT-SISTOS**
Proyecto Chat - Sistemas Operativos

Este sistema de chat implementado en C permite a múltiples usuarios conectarse a un servidor central, registrarse, chatear en grupo o en privado, consultar el estado de otros usuarios y modificar su propio estado. El sistema utiliza `sockets` y `threads (multithreading)` para soportar múltiples conexiones concurrentes.

## **Estructura del Proyecto**

```plaintext
CHAT-SISTOS/
│
├── build/                   # Archivos generados por CMake (no editar)
│
├── client/                  # Código fuente del cliente
│   ├── client               # Ejecutable generado (Linux)
│   ├── client.c             # Implementación del cliente
│   ├── client.o             # Archivo objeto del cliente
│   └── Makefile             # Compilación del cliente
│
├── frontend/                # Carpeta reservada para interfaz gráfica
│
├── server/                  # Código fuente del servidor (Linux)
│   ├── server               # Ejecutable generado (Linux)
│   ├── server.c             # Implementación principal del servidor
│   ├── server_utils.c       # Funciones auxiliares del servidor
│   ├── server_utils.h       # Encabezado de utilidades del servidor
│   ├── server_utils.o       # Archivo objeto de utilidades
│   ├── server.o             # Archivo objeto del servidor
│   └── Makefile             # Compilación del servidor
│
├── serverwindows/           # Versión del servidor para Windows
│   ├── server.exe           # Ejecutable para Windows
│   └── Makefile             # Compilación para entorno Windows
│
├── cJSON/                   # Biblioteca externa para manejo de JSON
│
├── utils/                   # Utilidades adicionales si se agregan
│
├── Makefile                 # Makefile raíz 
│
└── README.md                # Documentación del proyecto
```

## **Funcionalidades**

### **Cliente**

| Funcionalidad | Descripción |
|--------------|-------------|
| **Chateo general con usuarios** | El comando `/BROADCAST <mensaje>` permite enviar mensajes visibles para todos los usuarios conectados. |
| **Chateo privado con multithreading**  | El comando `/DM <usuario> <mensaje>` envía un mensaje directo a otro usuario. La recepción de mensajes se maneja en un hilo independiente (`receive_thread`). |
| **Cambio de _status_** | El comando `/ESTADO <nuevo_estado>` permite cambiar entre `ACTIVO`, `OCUPADO` o `INACTIVO`. El nuevo estado se actualiza localmente y se envía al servidor. |
| **Listado de usuarios e información de un usuario** | `/LISTA` muestra todos los usuarios conectados y `/MOSTRAR <usuario>` muestra el estado y dirección IP de un usuario específico. |

### **Servidor**

| Funcionalidad | Descripción |
|--------------|-------------|
| **Atención con multithreading** | Cada conexión entrante genera un nuevo hilo con `pthread_create` (`handle_client`). Esto permite gestionar múltiples clientes en paralelo. |
| **Broadcasting y mensajes directos** | Se usa la función `broadcast_message()` para difundir mensajes globales y `send_direct_message()` para mensajes privados. |
| **Registro de usuarios** | Los usuarios se registran al conectarse, enviando su nombre y dirección IP. Además, se validan duplicados. |
| **Liberación de usuarios** | Al desconectarse o usar el comando `/EXIT`, el usuario es marcado como inactivo y su socket se cierra. |
| **Manejo de _status_** | Se permite a los usuarios cambiar su estado, el cual se refleja en el listado `/LISTA` y en la respuesta a `/MOSTRAR`. |
| **Respuesta a solicitudes de información** | El servidor responde a `/LISTA` con todos los usuarios activos y/o ocupados y a `/MOSTRAR` con los detalles de un usuario específico. |

---

## **Multithreading Implementado** 

### En el Servidor
- **Archivo**: `server.c`
- **Función**: `pthread_create(&thread_id, NULL, handle_client, (void*)new_sock);`
- **Descripción**: Cada nuevo cliente que se conecta al servidor es atendido en un hilo separado, asegurando concurrencia y escalabilidad.

### En el Cliente
- **Archivo**: `client.c`
- **Función**: `pthread_create(&recv_thread, NULL, receive_thread, NULL);`
- **Descripción**: Se crea un hilo para escuchar mensajes del servidor mientras el usuario escribe. Esto permite recepción y envío simultáneo.

---

## **Cómo ejecutar**

### **1. Versión Windows (Servidor) + Ubuntu (Cliente)**

**Compilación del servidor en Windows**
En la carpeta ```serverwindows```, se compila con:

```bash
gcc -o server server.c server_utils.c cJSON/cJSON.c -I"c:\Users\rebe1\OneDrive\Documentos\GitHub\CHAT-SISTOS\serverwindows\cJSON" -lws2_32 -lpthread
```
**Nota: Asegúrate de actualizar la ruta cJSON a la correcta si es diferente en tu sistema.**


**Ejecución del servidor en Windows**
Ejecuta el servidor con:

```bash
./server.exe
```

**Compilación y ejecución del cliente en Ubuntu**
Dentro de la carpeta raíz del proyecto, limpia y compila el cliente:

```bash
make clean
make
```
Luego, ejecuta el cliente con
```bash
./client <nombre_usuario> <servidor_ip> <puerto>
```
Por ejemplo:
```bash
./client Juan 127.0.0.1 50214
```

### **2. Versión Ubuntu (Servidor y Cliente en Linux)**

**Compilación del servidor y cliente en Ubuntu**
Desde la carpeta raíz del proyecto:
```bash
make clean
make
```

**Ejecución del servidor en Ubuntu**
```bash
./server.exe
```

**Ejecución del cliente en Ubuntu**

```bash
./client <nombre_usuario> <servidor_ip> <puerto>
```
Por ejemplo:
```bash
./client Juan 127.0.0.1 50214
```

## **Comandos del Cliente** 

- `/BROADCAST <mensaje>` – Enviar mensaje global.
- `/DM <usuario> <mensaje>` – Enviar mensaje privado.
- `/LISTA` – Listar usuarios conectados.
- `/ESTADO <estado>` – Cambiar estado a `ACTIVO`, `OCUPADO` o `INACTIVO`.
- `/MOSTRAR <usuario>` – Mostrar información de un usuario.
- `/AYUDA` – Mostrar comandos disponibles.
- `/EXIT` – Salir del chat.

## **Funcionalidades**
* Todos los clientes reciben los mensajes realizados con `/BROADCAST`
* Al pasar **30** segundos sin realizar nada, el cliente pasa a estado `INACTIVO`
* La información mostrada de cada usuario es la siguiente:
    - `Nombre de usuario`
    - `Estado`
    - `IP`
* El comando `/LISTA` muestra únicamente los usuarios `ACTIVOS` u `OCUPADOS`
* No es posible conectarse con dos clientes teniendo el mismo **nombre** o **dirección IP**

## **Link del repositorio**
[CHAT-SISTOS](https://github.com/FabianKel/CHAT-SISTOS/tree/main)

## **Créditos del Proyecto**
- **[Paula Barillas - 22764](https://github.com/paulabaal12)**
- **[Mónica Salvatierra - 22249](https://github.com/alee2602)**
- **[Derek Arreaga - 22537](https://github.com/FabianKel)**