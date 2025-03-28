#ifdef _WIN32
    #include <winsock2.h>
    #include <ws2tcpip.h>
    #pragma comment(lib, "ws2_32.lib")
    #pragma comment(lib, "pthreadVC2.lib")
#else
    #include <arpa/inet.h>
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <unistd.h>
#endif

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <pthread.h>
#include "server_utils.h"
#include "cJSON.h"

#define PORT 50214

int main() {
    // Inicialización de Winsock
    #ifdef _WIN32
        WSADATA wsaData;
        if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
            printf("WSAStartup failed\n");
            return 1;
        }
    #endif

    int server_fd, new_socket;
    struct sockaddr_in address;
    socklen_t addrlen = sizeof(address);

    // Crear socket
    server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd < 0) {
        perror("Socket creation failed");
        return 1;
    }

    // Configuración de dirección
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(PORT);

    // Bindear socket
    if (bind(server_fd, (struct sockaddr*)&address, sizeof(address)) < 0) {
        perror("Bind failed");
        return 1;
    }

    // Escuchar conexiones
    if (listen(server_fd, MAX_CLIENTS) < 0) {
        perror("Listen failed");
        return 1;
    }

    printf("Servidor escuchando en puerto %d...\n", PORT);

    // Se crea un hilo para monitorear inactividad
    pthread_t inactivity_thread;
    if (pthread_create(&inactivity_thread, NULL, check_inactivity, NULL) != 0) {
        perror("Error al crear el hilo de inactividad");
        return 1;
    }
    pthread_detach(inactivity_thread);

    // Bucle de aceptación de conexiones
    while (1) {
        printf("Esperando conexiones...\n");
        new_socket = accept(server_fd, (struct sockaddr*)&address, &addrlen);
        if (new_socket < 0) {
            perror("Error aceptando conexión");
            continue;
        }

        printf("Nueva conexión aceptada desde %s:%d\n", 
               inet_ntoa(address.sin_addr), ntohs(address.sin_port));

        // Crear hilo para manejar cliente
        pthread_t thread_id;
        int *new_sock = malloc(sizeof(int));
        *new_sock = new_socket;
        
        if (pthread_create(&thread_id, NULL, handle_client, (void*)new_sock) != 0) {
            perror("Could not create thread");
            free(new_sock);
            continue;
        }
        pthread_detach(thread_id);
    }

    // Cerrar socket del servidor
    close(server_fd);

    // Limpieza de Winsock
    #ifdef _WIN32
        WSACleanup();
    #endif

    return 0;
}