#ifndef SERVER_UTILS_H
#define SERVER_UTILS_H

#define MAX_CLIENTS 10
#define ESTADO_LENGTH 32

typedef struct {
    int socket;
    char username[32];
    char ip_address[16];
    char estado[ESTADO_LENGTH];
} Client;

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

#endif
