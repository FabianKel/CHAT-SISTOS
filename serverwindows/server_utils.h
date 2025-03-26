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

#ifdef _WIN32
    #define socklen_t int
    #define close(s) closesocket(s)
#endif

typedef struct {
    int socket;
    char username[50];
    char ip_address[INET_ADDRSTRLEN];  // Changed to use standard INET address length
    char estado[ESTADO_LENGTH];
} Client;

extern Client *clients[MAX_CLIENTS];
extern pthread_mutex_t clients_mutex;

// Function prototypes based on server_utils.c implementation
void *handle_client(void *socket_desc);
int register_client(int socket, const char *username, const char *ip_address);
void send_json_response(int socket, const char *status, const char *key, const char *message);
void broadcast_message(const char *message, const char *emisor);
void send_direct_message(const char *receiver, const char *message, const char *emisor);
void list_connected_users(int socket);
void handle_estado(cJSON *parsed_cJSON, int sock);
void handle_mostrar(cJSON *parsed_cJSON, int sock);
void handle_register(cJSON *parsed_cJSON, int sock);
void handle_exit(cJSON *parsed_cJSON, int sock);
void remove_client(int socket);


#endif