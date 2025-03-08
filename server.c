#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <pthread.h>
#include <arpa/inet.h>
#include <json-c/json.h>

#define PORT 50213
#define MAX_CLIENTS 10

typedef struct {
    int socket;
    char username[32];
    char ip_address[16];
} Client;

Client *clients[MAX_CLIENTS]; // Lista con todos los clientes conectados
pthread_mutex_t clients_mutex = PTHREAD_MUTEX_INITIALIZER; // Mutex para manejar concurrencia

void *handle_client(void *socket_desc);
int register_client(int socket, const char *username, const char *ip_address);
void send_json_response(int socket, const char *status, const char *key, const char *message);

int main() {
    int server_fd, new_socket;
    struct sockaddr_in address;
    socklen_t addrlen = sizeof(address);

    // Crear socket del servidor
    server_fd = socket(AF_INET, SOCK_STREAM, 0);
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(PORT);

    bind(server_fd, (struct sockaddr*)&address, sizeof(address));
    listen(server_fd, MAX_CLIENTS);

    printf("Servidor en ejecución en el puerto %d...\n", PORT);

    while (1) {
        new_socket = accept(server_fd, (struct sockaddr*)&address, &addrlen);
        if (new_socket < 0) {
            perror("Error al aceptar conexión");
            continue;
        }

        // Crear hilo para manejar el cliente
        pthread_t thread_id;
        int *new_sock = malloc(sizeof(int));
        *new_sock = new_socket;
        pthread_create(&thread_id, NULL, handle_client, (void*)new_sock);
        pthread_detach(thread_id);
    }
    return 0;
}

void *handle_client(void *socket_desc) {
    int sock = *(int*)socket_desc;
    free(socket_desc);
    char buffer[1024];
    int read_size;

    // Recibir el JSON con el nombre de usuario y dirección IP
    read_size = recv(sock, buffer, sizeof(buffer), 0);
    if (read_size <= 0) {
        close(sock);
        return NULL;
    }
    buffer[read_size] = '\0';

    struct json_object *parsed_json = json_tokener_parse(buffer);
    struct json_object *tipo, *username, *ip_address;

    if (json_object_object_get_ex(parsed_json, "tipo", &tipo) &&
        json_object_object_get_ex(parsed_json, "usuario", &username) &&
        json_object_object_get_ex(parsed_json, "direccionIP", &ip_address)) {
        
        if (strcmp(json_object_get_string(tipo), "REGISTRO") == 0) {
            if (register_client(sock, json_object_get_string(username), json_object_get_string(ip_address))) {
                printf("Usuario registrado: %s | IP: %s\n", json_object_get_string(username), json_object_get_string(ip_address));
                send_json_response(sock, "OK", "response", "Registro exitoso");
            } else {
                printf("Usuario/IP duplicado: %s | %s\n", json_object_get_string(username), json_object_get_string(ip_address));
                send_json_response(sock, "ERROR", "razon", "Nombre o dirección duplicado");
                close(sock);
                return NULL;
            }
        }
    }
    json_object_put(parsed_json);

    // Mostrar mensajes recibidos
    read_size = recv(sock, buffer, sizeof(buffer), 0);
    if (read_size > 0) {
        buffer[read_size] = '\0';
        struct json_object *msg_json = json_tokener_parse(buffer);
        struct json_object *msg_tipo, *msg_contenido;

        if (json_object_object_get_ex(msg_json, "tipo", &msg_tipo) &&
            json_object_object_get_ex(msg_json, "mensaje", &msg_contenido)) {
            printf("📩 Mensaje recibido: %s\n", json_object_get_string(msg_contenido));
        }

        json_object_put(msg_json);
    }

    close(sock);
    return NULL;
}

int register_client(int socket, const char *username, const char *ip_address) {
    pthread_mutex_lock(&clients_mutex);
    for (int i = 0; i < MAX_CLIENTS; i++) {
        if (clients[i] != NULL && 
            (strcmp(clients[i]->username, username) == 0 || strcmp(clients[i]->ip_address, ip_address) == 0)) {
            pthread_mutex_unlock(&clients_mutex);
            return 0; // Nombre de usuario o dirección IP duplicada
        }
    }
    for (int i = 0; i < MAX_CLIENTS; i++) {
        if (clients[i] == NULL) {
            clients[i] = malloc(sizeof(Client));
            clients[i]->socket = socket;
            strncpy(clients[i]->username, username, sizeof(clients[i]->username));
            strncpy(clients[i]->ip_address, ip_address, sizeof(clients[i]->ip_address));
            pthread_mutex_unlock(&clients_mutex);
            return 1;
        }
    }
    pthread_mutex_unlock(&clients_mutex);
    return 0;
}

void send_json_response(int socket, const char *status, const char *key, const char *message) {
    struct json_object *json_response = json_object_new_object();
    json_object_object_add(json_response, key, json_object_new_string(message));

    const char *json_str = json_object_to_json_string(json_response);
    send(socket, json_str, strlen(json_str), 0);

    json_object_put(json_response);
}
