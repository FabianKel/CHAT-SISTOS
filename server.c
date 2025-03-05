#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <pthread.h>
#include <arpa/inet.h>
#include <json-c/json.h>

#define PORT 50213
#define MAX_CLIENTS 10

void *handle_client(void *socket_desc);

int main() {
    int server_fd, new_socket;
    struct sockaddr_in address;
    int addrlen = sizeof(address);

    server_fd = socket(AF_INET, SOCK_STREAM, 0);
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(PORT);

    bind(server_fd, (struct sockaddr*)&address, sizeof(address));
    listen(server_fd, MAX_CLIENTS);

    printf("Servidor en ejecución en el puerto %d...\n", PORT);

    while (1) {
        new_socket = accept(server_fd, (struct sockaddr*)&address, (socklen_t*)&addrlen);
        pthread_t thread_id;
        pthread_create(&thread_id, NULL, handle_client, (void*)&new_socket);
    }
    return 0;
}

void *handle_client(void *socket_desc) {
    int sock = *(int*)socket_desc;
    char buffer[1024];
    int read_size;

    while ((read_size = recv(sock, buffer, 1024, 0)) > 0) {
        buffer[read_size] = '\0';
        struct json_object *parsed_json = json_tokener_parse(buffer);
        struct json_object *tipo;
        json_object_object_get_ex(parsed_json, "tipo", &tipo);
        printf("Mensaje recibido: %s\n", json_object_get_string(tipo));
    }
    close(sock);
    return 0;
}
