#include <string.h>
#include "client_handler.h"
#include "message_processing.h"
#include "user_management.h"
#include "responses.h"

void *handle_client(void *socket_desc) {
    int sock = *(int*)socket_desc;
    free(socket_desc);
    char buffer[1024];
    
    // Registro inicial
    size_t read_size = recv(sock, buffer, sizeof(buffer), 0);
    if (read_size <= 0) {
        close(sock);
        return NULL;
    }
    buffer[read_size] = '\0';
    
    struct json_object *msg = json_tokener_parse(buffer);
    handle_json_message(msg, sock);
    json_object_put(msg);
    
    // Bucle de mensajes
    while ((read_size = recv(sock, buffer, sizeof(buffer), 0)) > 0) {
        buffer[read_size] = '\0';
        msg = json_tokener_parse(buffer);
        handle_json_message(msg, sock);
        json_object_put(msg);
    }
    
    remove_client(sock);
    close(sock);
    return NULL;
}