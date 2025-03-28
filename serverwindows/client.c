#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <pthread.h>
#include "cJSON.h"
#ifdef _WIN32
    #include <windows.h> 
    #include <winsock2.h>
    #include <ws2tcpip.h>
    #pragma comment(lib, "ws2_32.lib")
    #pragma comment(lib, "pthreadVC2.lib")
    #define close closesocket
    #define inet_pton InetPton
    #define inet_ntop InetNtop
    #include <iphlpapi.h>
    #pragma comment(lib, "iphlpapi.lib")
#else
    #include <arpa/inet.h>
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <unistd.h>
    #include <ifaddrs.h> // Add this header for getifaddrs() function and struct ifaddrs
#endif

#ifndef _WIN32_WINNT
    #define _WIN32_WINNT 0x0600
#endif

#define PORT 50214
#define BUFFER_SIZE 1024

int sock;
char username[BUFFER_SIZE];
char ip_local[BUFFER_SIZE];

#ifdef _WIN32
void obtener_ip_local(char *ip_buffer) {
    PIP_ADAPTER_ADDRESSES adapter_addresses = NULL, adapter = NULL;
    ULONG out_buf_len = 0;
    DWORD ret;

    // Get the required buffer size
    ret = GetAdaptersAddresses(AF_INET, 0, NULL, adapter_addresses, &out_buf_len);
    if (ret == ERROR_BUFFER_OVERFLOW) {
        adapter_addresses = (PIP_ADAPTER_ADDRESSES)malloc(out_buf_len);
        if (!adapter_addresses) {
            perror("Error al asignar memoria");
            exit(EXIT_FAILURE);
        }
    }

    // Retrieve adapter addresses
    ret = GetAdaptersAddresses(AF_INET, 0, NULL, adapter_addresses, &out_buf_len);
    if (ret != NO_ERROR) {
        perror("Error al obtener direcciones IP");
        free(adapter_addresses);
        exit(EXIT_FAILURE);
    }

    // Iterate through adapters to find a private IP
    for (adapter = adapter_addresses; adapter; adapter = adapter->Next) {
        PIP_ADAPTER_UNICAST_ADDRESS unicast = adapter->FirstUnicastAddress;
        while (unicast) {
            struct sockaddr_in *addr = (struct sockaddr_in *)unicast->Address.lpSockaddr;
            char *ip = inet_ntoa(addr->sin_addr);

            // Check for private IP ranges
            if (strncmp(ip, "192.168.", 8) == 0 || strncmp(ip, "10.", 3) == 0 || strncmp(ip, "172.16.", 7) == 0) {
                strncpy(ip_buffer, ip, BUFFER_SIZE);
                free(adapter_addresses);
                return;
            }
            unicast = unicast->Next;
        }
    }

    free(adapter_addresses);
    strcpy(ip_buffer, "No se encontró IP privada");
}
#else
// Función para obtener la IP local del cliente
void obtener_ip_local(char *ip_buffer) {
    struct ifaddrs *ifaddr, *ifa;
    void *tmp_addr;

    if (getifaddrs(&ifaddr) == -1) {
        perror("Error obteniendo dirección IP");
        exit(EXIT_FAILURE);
    }

    // Initialize ip_buffer to a default value
    strcpy(ip_buffer, "No se encontró IP privada");

    for (ifa = ifaddr; ifa != NULL; ifa = ifa->ifa_next) {
        if (ifa->ifa_addr == NULL) continue;
        if (ifa->ifa_addr->sa_family == AF_INET) { // Solo IPv4
            struct sockaddr_in *addr = (struct sockaddr_in *)ifa->ifa_addr;
            tmp_addr = &addr->sin_addr;
            inet_ntop(AF_INET, tmp_addr, ip_buffer, BUFFER_SIZE);

            // Solo aceptar IPs privadas (para evitar 127.0.0.1 o públicas)
            if (strncmp(ip_buffer, "192.168.", 8) == 0 || 
                strncmp(ip_buffer, "10.", 3) == 0 ||
                strncmp(ip_buffer, "172.16.", 7) == 0) {
                break;
            }
        }
    }

    freeifaddrs(ifaddr);
}
#endif

// Función para enviar un mensaje
void enviar_mensaje(const char *mensaje, const char *destinatario) {
    cJSON *json = cJSON_CreateObject();
    
    if (destinatario == NULL || strlen(destinatario) == 0) {
        cJSON_AddStringToObject(json, "accion", "BROADCAST");
    } else {
        cJSON_AddStringToObject(json, "accion", "DM");
        cJSON_AddStringToObject(json, "nombre_destinatario", destinatario);
    }
    
    cJSON_AddStringToObject(json, "nombre_emisor", username);
    cJSON_AddStringToObject(json, "mensaje", mensaje);

    char *json_str = cJSON_PrintUnformatted(json);
    cJSON_Delete(json);

    if (send(sock, json_str, strlen(json_str), 0) < 0) {
        perror("Error al enviar mensaje");
    }
    free(json_str);
}

// Función para cambiar el estado del cliente
void cambiar_estado(const char *nuevo_estado) {
    cJSON *json = cJSON_CreateObject();
    cJSON_AddStringToObject(json, "tipo", "ESTADO");
    cJSON_AddStringToObject(json, "usuario", username);
    cJSON_AddStringToObject(json, "estado", nuevo_estado);
    char *json_str = cJSON_PrintUnformatted(json);
    cJSON_Delete(json);

    if (send(sock, json_str, strlen(json_str), 0) < 0) {
        perror("Error al cambiar estado");
    } else {
        printf("Estado cambiado a: %s\n", nuevo_estado);
    }

    free(json_str);
}

// Función para listar usuarios conectados
void listar_usuarios() {
    cJSON *json = cJSON_CreateObject();
    cJSON_AddStringToObject(json, "accion", "LISTA");
    cJSON_AddStringToObject(json, "nombre_usuario", username);
    char *json_str = cJSON_PrintUnformatted(json);
    cJSON_Delete(json);

    if (send(sock, json_str, strlen(json_str), 0) < 0) {
        perror("Error al solicitar listado de usuarios");
    }
    free(json_str);
}

// Función para consultar información de un usuario
void consultar_info_usuario() {
    printf("Introduce el nombre del usuario a consultar: ");
    char usuario_info[BUFFER_SIZE];
    fgets(usuario_info, BUFFER_SIZE, stdin);
    usuario_info[strcspn(usuario_info, "\n")] = 0;

    cJSON *json = cJSON_CreateObject();
    cJSON_AddStringToObject(json, "tipo", "MOSTRAR");
    cJSON_AddStringToObject(json, "usuario", usuario_info);
    char *json_str = cJSON_PrintUnformatted(json);
    cJSON_Delete(json);

    if (send(sock, json_str, strlen(json_str), 0) < 0) {
        perror("Error al consultar información de usuario");
    }
    free(json_str);
}

// Función para enviar mensaje de desconexión "EXIT"
void enviar_exit() {
    cJSON *json = cJSON_CreateObject();
    cJSON_AddStringToObject(json, "tipo", "EXIT");
    cJSON_AddStringToObject(json, "usuario", username);
    cJSON_AddStringToObject(json, "estado", "");

    char *json_str = cJSON_PrintUnformatted(json);
    cJSON_Delete(json);

    if (send(sock, json_str, strlen(json_str), 0) < 0) {
        perror("Error al enviar mensaje de desconexión");
    }
    free(json_str);
}

// Hilo para recibir mensajes
void *recibir_mensajes(void *arg) {
    char response[BUFFER_SIZE];

    while (1) {
        int len = recv(sock, response, sizeof(response) - 1, 0);
        if (len > 0) {
            response[len] = '\0';

            cJSON *json_response = cJSON_Parse(response);
            if (!json_response) {
                printf("\nMensaje recibido (formato incorrecto): %s\n", response);
            } else {
                // Se pueden recibir mensajes con diferentes claves, se muestra lo recibido
                cJSON *accion = cJSON_GetObjectItem(json_response, "accion");
                cJSON *mensaje = cJSON_GetObjectItem(json_response, "mensaje");
                cJSON *nombre_emisor = cJSON_GetObjectItem(json_response, "nombre_emisor");  // Obtener el nombre del emisor
                cJSON *response_field = cJSON_GetObjectItem(json_response, "response");
                cJSON *respuesta = cJSON_GetObjectItem(json_response, "respuesta");

                if (accion && cJSON_IsString(accion) && mensaje && cJSON_IsString(mensaje) && nombre_emisor && cJSON_IsString(nombre_emisor)) {
                    if (strcmp(accion->valuestring, "BROADCAST") == 0) {
                        printf("\n[%s] %s: %s\n", accion->valuestring, nombre_emisor->valuestring, mensaje->valuestring);
                    } else if (strcmp(accion->valuestring, "DM") == 0) {
                        printf("\n[DM] %s -> %s: %s\n", nombre_emisor->valuestring, cJSON_GetObjectItem(json_response, "nombre_destinatario")->valuestring, mensaje->valuestring);
                    }
                } else if (response_field && cJSON_IsString(response_field)) {
                    printf("\nRespuesta del servidor: %s\n", response_field->valuestring);
                } else if (respuesta && cJSON_IsString(respuesta)) {
                    printf("\nRespuesta del servidor: %s\n", respuesta->valuestring);
                } else {
                    printf("\nMensaje recibido: %s\n", response);
                }
                cJSON_Delete(json_response);
            }
            printf("\nSelecciona una opción: ");
            fflush(stdout);
        }
    }
    return NULL;
}

int main() {
    struct sockaddr_in server;

    // Crear socket
    sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock == -1) {
        perror("No se pudo crear el socket");
        return 1;
    }

    server.sin_addr.s_addr = inet_addr("192.168.0.12");  // IP del servidor
    server.sin_family = AF_INET;
    server.sin_port = htons(PORT);

    // Conectar con el servidor
    if (connect(sock, (struct sockaddr *)&server, sizeof(server)) < 0) {
        perror("Error al conectar al servidor");
        return 1;
    }

    // Obtener IP local automáticamente
    obtener_ip_local(ip_local);

    // Registro del usuario
    printf("Introduce tu nombre de usuario: ");
    fgets(username, BUFFER_SIZE, stdin);
    username[strcspn(username, "\n")] = 0;

    cJSON *json = cJSON_CreateObject();
    cJSON_AddStringToObject(json, "tipo", "REGISTRO");
    cJSON_AddStringToObject(json, "usuario", username);
    char *json_str = cJSON_PrintUnformatted(json);
    cJSON_Delete(json);

    if (send(sock, json_str, strlen(json_str), 0) < 0) {
        perror("Error al registrar usuario");
    } else {
        printf("Usuario '%s' registrado correctamente.\n", username);
    }
    free(json_str);

    // Crear hilo para recibir mensajes
    pthread_t thread_id;
    if (pthread_create(&thread_id, NULL, recibir_mensajes, NULL) < 0) {
        perror("Error al crear el hilo de recepción");
        return 1;
    }

    // Menú interactivo
    while (1) {
        printf("\nOpciones:\n");
        printf("1. Chatear con todos\n");
        printf("2. Chatear con un usuario (DM)\n");
        printf("3. Cambiar estado\n");
        printf("4. Listar usuarios\n");
        printf("5. Consultar información de un usuario\n");
        printf("6. Salir\n");
        printf("Selecciona una opción: ");
        int opcion;
        if (scanf("%d", &opcion) != 1) {
            printf("Entrada inválida.\n");
            while (getchar() != '\n');
            continue;
        }
        getchar();

        switch (opcion) {
            case 1:
                printf("Escribe tu mensaje: ");
                char mensaje[BUFFER_SIZE];
                fgets(mensaje, BUFFER_SIZE, stdin);
                mensaje[strcspn(mensaje, "\n")] = 0;
                enviar_mensaje(mensaje, NULL);
                break;
            case 2:
                printf("Introduce el destinatario: ");
                char destinatario[BUFFER_SIZE];
                fgets(destinatario, BUFFER_SIZE, stdin);
                destinatario[strcspn(destinatario, "\n")] = 0;
                printf("Escribe tu mensaje: ");
                fgets(mensaje, BUFFER_SIZE, stdin);
                mensaje[strcspn(mensaje, "\n")] = 0;
                enviar_mensaje(mensaje, destinatario);
                break;
            case 3:
                printf("Introduce tu nuevo estado: ");
                char estado[BUFFER_SIZE];
                fgets(estado, BUFFER_SIZE, stdin);
                estado[strcspn(estado, "\n")] = 0;
                cambiar_estado(estado);
                break;
            case 4:
                listar_usuarios();
                break;
            case 5:
                consultar_info_usuario();
                break;
            case 6:
                // Enviar mensaje de desconexión
                printf("Desconectando...\n");
                enviar_exit();

                // Cerrar el socket
                close(sock);
                // Terminar el hilo de recepción
                pthread_cancel(thread_id);
                pthread_join(thread_id, NULL);
                printf("Desconectado del servidor.\n");
                return 0;
            default:
                printf("Opción no válida. Intenta de nuevo.\n");
        }
    }

    return 0;
}