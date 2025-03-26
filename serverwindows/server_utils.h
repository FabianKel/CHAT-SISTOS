#ifndef SERVER_UTILS_H
#define SERVER_UTILS_H

#ifdef _WIN32
    #include <winsock2.h>
    #include <ws2tcpip.h>
    #pragma comment(lib, "ws2_32.lib")
#else
    #include <arpa/inet.h>
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <unistd.h>
#endif

#include <pthread.h>
#include "cJSON.h" 

#define MAX_CLIENTS 100
#define ESTADO_LENGTH 10
#define USERNAME_LENGTH 50
#define IP_LENGTH INET_ADDRSTRLEN

#ifdef _WIN32
    #define socklen_t int
    #define close(s) closesocket(s)
#endif

// Estructura para almacenar la información de cada cliente
typedef struct {
    int socket;
    char username[USERNAME_LENGTH];
    char ip_address[IP_LENGTH];
    char estado[ESTADO_LENGTH];
    int is_active;  // Para rastrear si el cliente está conectado
} Client;

// Variables globales para la lista de clientes
extern Client clients[MAX_CLIENTS];
extern int client_count;

// Mutex para manejo concurrente de la lista de clientes
#ifdef _WIN32
    extern HANDLE clients_mutex;
#else
    extern pthread_mutex_t clients_mutex;
#endif

// Manejador principal de cliente (thread)
#ifdef _WIN32
    DWORD WINAPI handle_client(LPVOID arg);
#else
    void *handle_client(void *arg);
#endif

// Añadir un nuevo cliente a la lista
void add_client(Client client);

// Eliminar un cliente de la lista (marcar como inactivo)
void remove_client(int sock);

// Buscar un cliente por nombre de usuario
Client* find_client_by_username(const char* username);

// Enviar mensaje a un socket
void enviar_mensaje(int sock, const char *mensaje);

// Enviar mensaje JSON a un socket
void enviar_JSON(int sock, cJSON *json);

// Funciones adicionales para manejo de operaciones específicas
void broadcast_message(const char *message, const char *emisor);
void send_direct_message(const char *receiver, const char *message, const char *emisor);
void list_connected_users(int socket);

#endif