#ifndef SERVER_UTILS_H
#define SERVER_UTILS_H

#include <pthread.h>
#include <time.h>

#define MAX_CLIENTS 100
#define ESTADO_LENGTH 10

typedef struct {
    int socket;
    char username[50];
    char ip_address[16];
    char estado[ESTADO_LENGTH];
    time_t last_activity;
} Client;


extern Client *clients[MAX_CLIENTS];
extern pthread_mutex_t clients_mutex;

void *handle_client(void *socket_desc);
int register_client(int socket, const char *username, const char *ip_address);
void send_json_response(int socket, const char *status, const char *key, const char *message);
void broadcast_message(const char *message, const char *emisor);
void send_direct_message(const char *receiver, const char *message, const char *emisor);
void list_connected_users(int socket);
void handle_estado(struct json_object *parsed_json, int sock);
void handle_mostrar(struct json_object *parsed_json, int sock);
void remove_client(int socket);
void handle_register(struct json_object *parsed_json, int sock);
void handle_exit(struct json_object *parsed_json, int sock);
void *check_activity(void *socket_desc);
void init_clients();

#endif 