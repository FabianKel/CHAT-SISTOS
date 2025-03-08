#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <json-c/json.h>

#define PORT 50213
#define SERVER_IP "127.0.0.1"

int sock;

int main() {
    struct sockaddr_in server_address;
    char buffer[1024];
    char username[32], ip_address[16];

    printf("Ingrese su nombre de usuario: ");
    fgets(username, sizeof(username), stdin);
    username[strcspn(username, "\n")] = 0;

    printf("Ingrese su dirección IP (ej. 192.168.1.1): ");
    fgets(ip_address, sizeof(ip_address), stdin);
    ip_address[strcspn(ip_address, "\n")] = 0;

    // Conectar al servidor
    sock = socket(AF_INET, SOCK_STREAM, 0);
    server_address.sin_family = AF_INET;
    server_address.sin_port = htons(PORT);
    inet_pton(AF_INET, SERVER_IP, &server_address.sin_addr);

    if (connect(sock, (struct sockaddr*)&server_address, sizeof(server_address)) < 0) {
        perror("Error al conectar");
        return 1;
    }

    // Crear JSON para enviar el registro
    struct json_object *json_msg = json_object_new_object();
    json_object_object_add(json_msg, "tipo", json_object_new_string("REGISTRO"));
    json_object_object_add(json_msg, "usuario", json_object_new_string(username));
    json_object_object_add(json_msg, "direccionIP", json_object_new_string(ip_address));
    const char *json_str = json_object_to_json_string(json_msg);

    send(sock, json_str, strlen(json_str), 0);
    json_object_put(json_msg);

    // Recibir respuesta del servidor
    int read_size = recv(sock, buffer, sizeof(buffer), 0);
    buffer[read_size] = '\0';

    struct json_object *json_response = json_tokener_parse(buffer);
    struct json_object *response;
    if (json_object_object_get_ex(json_response, "response", &response)) {
        printf("Servidor: %s\n", json_object_get_string(response));
    } else {
        struct json_object *razon;
        json_object_object_get_ex(json_response, "razon", &razon);
        printf("Error: %s\n", json_object_get_string(razon));
        close(sock);
        return 1;
    }

    json_object_put(json_response);
    char message[256];

    printf("Ingrese un mensaje para enviar: ");
    fgets(message, sizeof(message), stdin);
    message[strcspn(message, "\n")] = 0;

    // Crear JSON con el mensaje enviado por el cliente
    json_msg = json_object_new_object();
    json_object_object_add(json_msg, "tipo", json_object_new_string("MENSAJE"));
    json_object_object_add(json_msg, "mensaje", json_object_new_string(message));
    json_str = json_object_to_json_string(json_msg);

    send(sock, json_str, strlen(json_str), 0);
    json_object_put(json_msg);

    printf("Mensaje enviado al servidor.\n");

    close(sock);
    return 0;
}
