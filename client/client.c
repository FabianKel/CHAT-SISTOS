#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <json-c/json.h>

#define PORT 50213

int sock;

void enviar_json(const char *json_str) {
    // Mostrar el JSON que se va a enviar
    printf("Enviando JSON: %s\n", json_str);
    
    if (send(sock, json_str, strlen(json_str), 0) < 0) {
        perror("Error al enviar mensaje");
    }
}

void manejar_comando(char *message, const char *username, const char *server_ip) {
    struct json_object *json_msg;
    const char *json_str;

    // Verificar si el mensaje comienza con "/"
    if (message[0] == '/') {
        if(strncmp(message, "/EXIT", 4) == 0){
            json_msg = json_object_new_object();
            json_object_object_add(json_msg, "tipo", json_object_new_string("EXIT"));
            json_object_object_add(json_msg, "usuario", json_object_new_string(username));
            json_object_object_add(json_msg, "estado", json_object_new_string(""));
            json_str = json_object_to_json_string(json_msg);
            enviar_json(json_str);
            json_object_put(json_msg);

        } else if (strncmp(message, "/BROADCAST", 10) == 0) {
            // Comando de broadcast
            char mensaje[256];
            snprintf(mensaje, sizeof(mensaje), "%s", message + 11); // Obtener el mensaje después del comando

            // Crear JSON para BROADCAST
            json_msg = json_object_new_object();
            json_object_object_add(json_msg, "accion", json_object_new_string("BROADCAST"));
            json_object_object_add(json_msg, "nombre_emisor", json_object_new_string(username));
            json_object_object_add(json_msg, "mensaje", json_object_new_string(mensaje));
            json_str = json_object_to_json_string(json_msg);
            enviar_json(json_str);
            json_object_put(json_msg);
        } else if (strncmp(message, "/DM", 3) == 0) {
            // Comando de DM (Direct Message)
            char destinatario[256], mensaje[256];
            sscanf(message + 4, "%s %[^\n]", destinatario, mensaje);

            // Crear JSON para DM
            json_msg = json_object_new_object();
            json_object_object_add(json_msg, "accion", json_object_new_string("DM"));
            json_object_object_add(json_msg, "nombre_emisor", json_object_new_string(username));
            json_object_object_add(json_msg, "nombre_destinatario", json_object_new_string(destinatario));
            json_object_object_add(json_msg, "mensaje", json_object_new_string(mensaje));
            json_str = json_object_to_json_string(json_msg);
            enviar_json(json_str);
            json_object_put(json_msg);
        } else if (strncmp(message, "/LISTA", 6) == 0) {
            // Comando para solicitar la lista de usuarios
            json_msg = json_object_new_object();
            json_object_object_add(json_msg, "accion", json_object_new_string("LISTA"));
            json_object_object_add(json_msg, "nombre_usuario", json_object_new_string(username));
            json_str = json_object_to_json_string(json_msg);
            enviar_json(json_str);
            json_object_put(json_msg);
        } else if (strncmp(message, "/ESTADO", 7) == 0) {
            // Comando para cambiar estado
            char estado[256];
            sscanf(message + 8, "%s", estado);

            // Crear JSON para ESTADO
            json_msg = json_object_new_object();
            json_object_object_add(json_msg, "tipo", json_object_new_string("ESTADO"));
            json_object_object_add(json_msg, "usuario", json_object_new_string(username));
            json_object_object_add(json_msg, "estado", json_object_new_string(estado));
            json_str = json_object_to_json_string(json_msg);
            enviar_json(json_str);
            json_object_put(json_msg);
        } else if (strncmp(message, "/MOSTRAR", 8) == 0) {
            // Comando para mostrar información de usuario
            char usuario[256];
            sscanf(message + 9, "%s", usuario);

            // Crear JSON para MOSTRAR
            json_msg = json_object_new_object();
            json_object_object_add(json_msg, "tipo", json_object_new_string("MOSTRAR"));
            json_object_object_add(json_msg, "usuario", json_object_new_string(usuario));
            json_str = json_object_to_json_string(json_msg);
            enviar_json(json_str);
            json_object_put(json_msg);
        } else {
            printf("Comando desconocido\n");
        }
    } else {
        // Enviar mensaje normal
        json_msg = json_object_new_object();
        json_object_object_add(json_msg, "tipo", json_object_new_string("MENSAJE"));
        json_object_object_add(json_msg, "usuario", json_object_new_string(username));
        json_object_object_add(json_msg, "mensaje", json_object_new_string(message));
        json_str = json_object_to_json_string(json_msg);
        enviar_json(json_str);
        json_object_put(json_msg);
    }
}

int main(int argc, char *argv[]) {
    if (argc != 4) {
        printf("Uso: %s <nombre_usuario> <IP_servidor> <puerto>\n", argv[0]);
        return 1;
    }

    char *username = argv[1];
    char *server_ip = argv[2];
    int port = atoi(argv[3]);

    struct sockaddr_in server_address;
    char buffer[4096];

    // Conectar al servidor
    sock = socket(AF_INET, SOCK_STREAM, 0);
    server_address.sin_family = AF_INET;
    server_address.sin_port = htons(port);
    inet_pton(AF_INET, server_ip, &server_address.sin_addr);

    if (connect(sock, (struct sockaddr*)&server_address, sizeof(server_address)) < 0) {
        perror("Error al conectar");
        return 1;
    }

    // Crear JSON para enviar el registro
    struct json_object *json_msg = json_object_new_object();
    json_object_object_add(json_msg, "tipo", json_object_new_string("REGISTRO"));
    json_object_object_add(json_msg, "usuario", json_object_new_string(username));
    json_object_object_add(json_msg, "direccionIP", json_object_new_string(server_ip));
    const char *json_str = json_object_to_json_string(json_msg);

    enviar_json(json_str);
    json_object_put(json_msg);

    // Recibir respuesta del servidor
    int read_size = recv(sock, buffer, sizeof(buffer), 0);
    if (read_size < 0) {
        perror("Error al recibir mensaje");
        close(sock);
        return 1;
    }
    buffer[read_size] = '\0';

    printf("Mensaje recibido del servidor: %s\n", buffer);

    struct json_object *json_response = json_tokener_parse(buffer);
    struct json_object *respuesta, *razon;
    if (json_object_object_get_ex(json_response, "respuesta", &respuesta)) {
        const char *respuesta_str = json_object_get_string(respuesta);
        printf("Servidor respondió: %s\n", respuesta_str);
        if (strcmp(respuesta_str, "OK") == 0 || strcmp(respuesta_str, "Registro exitoso") == 0) {
            printf("Servidor: Registro exitoso\n");
        } else {
            if (json_object_object_get_ex(json_response, "razon", &razon)) {
                printf("Error: %s\n", json_object_get_string(razon));
            } else {
                printf("Error desconocido en respuesta del servidor\n");
            }
        }
    } else {
        printf("Error: Respuesta inválida del servidor\n");
    }

    json_object_put(json_response);
    char message[256];

    while (1) {
        printf("Ingrese un mensaje para enviar (o escriba /EXIT para salir): ");
        fgets(message, sizeof(message), stdin);
        message[strcspn(message, "\n")] = 0;
	
        
        manejar_comando(message, username, server_ip);

        if (strcmp(message, "/EXIT") == 0) {
            break;
        }

    }

    close(sock);
    return 0;
}


