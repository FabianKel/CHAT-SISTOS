#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <json-c/json.h>

#define PORT 50213
#define SERVER_IP "127.0.0.1"

int main() {
    int sock;
    struct sockaddr_in server_address;
    char message[1024];
    
    sock = socket(AF_INET, SOCK_STREAM, 0);
    server_address.sin_family = AF_INET;
    server_address.sin_port = htons(PORT);
    inet_pton(AF_INET, SERVER_IP, &server_address.sin_addr);

    connect(sock, (struct sockaddr*)&server_address, sizeof(server_address));
    
    while (1) {
        printf("Ingrese un mensaje: ");
        fgets(message, 1024, stdin);
        message[strcspn(message, "\n")] = 0;

        struct json_object *json_msg = json_object_new_object();
        json_object_object_add(json_msg, "tipo", json_object_new_string(message));
        const char *json_str = json_object_to_json_string(json_msg);

        send(sock, json_str, strlen(json_str), 0);
    }
    close(sock);
    return 0;
}
