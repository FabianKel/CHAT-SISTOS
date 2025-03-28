#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#ifdef _WIN32
    #include <ws2tcpip.h>
    #include <windows.h>
    #pragma comment(lib, "ws2_32.lib")
#else
    #include <unistd.h>
    #include <sys/types.h>
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <arpa/inet.h>
    #include <pthread.h>
#endif

#include "cJSON.h"
#include "server_utils.h"

#define BUFFER_SIZE 1024

// Variables globales para la gestión de clientes
Client clients[MAX_CLIENTS];
int client_count = 0;

#ifdef _WIN32
    HANDLE clients_mutex = NULL;
#else
    pthread_mutex_t clients_mutex = PTHREAD_MUTEX_INITIALIZER;
#endif

// Añadir un nuevo cliente a la lista
void add_client(Client client) {
#ifdef _WIN32
    WaitForSingleObject(clients_mutex, INFINITE);
#else
    pthread_mutex_lock(&clients_mutex);
#endif
    
    if (client_count < MAX_CLIENTS) {
        client.is_active = 1;  // Marcar como activo
        client.last_action = time(NULL); // Inicializa con el tiempo actual
        clients[client_count++] = client;
    } else {
        fprintf(stderr, "Se alcanzó el máximo de clientes.\n");
    }
    
#ifdef _WIN32
    ReleaseMutex(clients_mutex);
#else
    pthread_mutex_unlock(&clients_mutex);
#endif
}

// Eliminar un cliente (marcar como inactivo)
void remove_client(int sock) {
#ifdef _WIN32
    WaitForSingleObject(clients_mutex, INFINITE);
#else
    pthread_mutex_lock(&clients_mutex);
#endif
    
    for (int i = 0; i < client_count; i++) {
        if (clients[i].socket == sock) {
            clients[i].is_active = 0;  // Marcar como inactivo
            break;
        }
    }
    
#ifdef _WIN32
    ReleaseMutex(clients_mutex);
#else
    pthread_mutex_unlock(&clients_mutex);
#endif
}

// Buscar cliente por nombre de usuario
Client* find_client_by_username(const char* username) {
    #ifdef _WIN32
        WaitForSingleObject(clients_mutex, INFINITE);
    #else
        pthread_mutex_lock(&clients_mutex);
    #endif
        
        Client* result = NULL;
        for (int i = 0; i < client_count; i++) {
            if (clients[i].is_active && strcmp(clients[i].username, username) == 0) {
                result = &clients[i];
                break;
            }
        }
        
    #ifdef _WIN32
        ReleaseMutex(clients_mutex);
    #else
        pthread_mutex_unlock(&clients_mutex);
    #endif
        
    return result;
}

void* check_inactivity(void *arg) {
    while (1) {
#ifdef _WIN32
        Sleep(5000);
#else
        sleep(5);
#endif

#ifdef _WIN32
        WaitForSingleObject(clients_mutex, INFINITE);
#else
        pthread_mutex_lock(&clients_mutex);
#endif

        time_t now = time(NULL);
        for (int i = 0; i < client_count; i++) {
            if (clients[i].is_active && (now - clients[i].last_action > INACTIVITY_THRESHOLD)) {
                strncpy(clients[i].estado, "INACTIVO", sizeof(clients[i].estado) - 1);
                printf("Usuario %s marcado como INACTIVO por inactividad.\n", clients[i].username);
            }
        }

#ifdef _WIN32
        ReleaseMutex(clients_mutex);
#else
        pthread_mutex_unlock(&clients_mutex);
#endif
    }
    return NULL;
}

void actualizar_actividad(Client* client) {
    #ifdef _WIN32
        WaitForSingleObject(clients_mutex, INFINITE);
    #else
        pthread_mutex_lock(&clients_mutex);
    #endif
    
    for (int i = 0; i < client_count; i++) {
        if (clients[i].socket == client->socket) {
            
            if (strcmp(clients[i].estado, "INACTIVO") == 0) {
                printf("Actividad actualizada para %s a ACTIVO\n", clients[i].username);
            }
            clients[i].last_action = time(NULL);
            clients[i].is_active = 1; // Opcional, si deseas marcarlo como activo
            strncpy(clients[i].estado, "ACTIVO", sizeof(clients[i].estado) - 1);
            clients[i].estado[sizeof(clients[i].estado) - 1] = '\0'; 

            break;
        }
    }
    #ifdef _WIN32
        ReleaseMutex(clients_mutex);
    #else
        pthread_mutex_unlock(&clients_mutex);
    #endif
}
// Enviar mensaje a un socket
void enviar_mensaje(int sock, const char *mensaje) {
    send(sock, mensaje, strlen(mensaje), 0);
}

// Enviar mensaje JSON a un socket
void enviar_JSON(int sock, cJSON *json) {
    char *mensaje = cJSON_PrintUnformatted(json);
    if(mensaje) {
        enviar_mensaje(sock, mensaje);
        free(mensaje);
    }
}

// Broadcast: enviar mensaje a todos los clientes activos
void broadcast_message(const char *message, const char *emisor) {
#ifdef _WIN32
    WaitForSingleObject(clients_mutex, INFINITE);
#else
    pthread_mutex_lock(&clients_mutex);
#endif
    
    for (int i = 0; i < client_count; i++) {
        if (clients[i].is_active) {
            enviar_mensaje(clients[i].socket, message);
        }
    }
    
#ifdef _WIN32
    ReleaseMutex(clients_mutex);
#else
    pthread_mutex_unlock(&clients_mutex);
#endif
}

// Enviar mensaje directo a un usuario específico
void send_direct_message(const char *receiver, const char *message, const char *emisor) {
    Client *dest = find_client_by_username(receiver);
    if (dest) {
        enviar_mensaje(dest->socket, message);
    }
}

// Listar usuarios conectados
void list_connected_users(int socket) {
    #ifdef _WIN32
        WaitForSingleObject(clients_mutex, INFINITE);
    #else
        pthread_mutex_lock(&clients_mutex);
    #endif
        
        cJSON *lista = cJSON_CreateArray();
        for (int i = 0; i < client_count; i++) {
            if (clients[i].is_active) {
                cJSON *usuario = cJSON_CreateObject();
                cJSON_AddStringToObject(usuario, "nombre", clients[i].username);
                cJSON_AddStringToObject(usuario, "estado", clients[i].estado);
                cJSON_AddItemToArray(lista, usuario);
            }
        }
        
        
        cJSON *resp = cJSON_CreateObject();
        cJSON_AddStringToObject(resp, "accion", "LISTA");  
        cJSON_AddItemToObject(resp, "usuarios", lista);
        
        enviar_JSON(socket, resp);
        cJSON_Delete(resp);
        
    #ifdef _WIN32
        ReleaseMutex(clients_mutex);
    #else
        pthread_mutex_unlock(&clients_mutex);
    #endif
    }

// Función principal de manejo de cliente (thread)
#ifdef _WIN32
DWORD WINAPI handle_client(LPVOID arg) {
#else
void *handle_client(void *arg) {
#endif
    int client_socket = *(int*)arg;
    free(arg);
    
    char buffer[BUFFER_SIZE];
    int bytes_read;
    int registered = 0;
    Client client_info = {0};
    client_info.socket = client_socket;
    client_info.is_active = 0;

    while ((bytes_read = recv(client_socket, buffer, BUFFER_SIZE - 1, 0)) > 0) {
        buffer[bytes_read] = '\0';
        strncpy(client_info.estado, "INACTIVO", sizeof(client_info.estado) - 1);

        actualizar_actividad(&client_info);
        printf("Mensaje recibido: %s\n", buffer);
        cJSON *json = cJSON_Parse(buffer);
        if (!json) {
            fprintf(stderr, "Error al parsear JSON\n");
            continue;
        }

        cJSON *tipo = cJSON_GetObjectItemCaseSensitive(json, "tipo");
        cJSON *accion = cJSON_GetObjectItemCaseSensitive(json, "accion");

       // REGISTRO de usuario

        if (tipo && strcmp(tipo->valuestring, "REGISTRO") == 0) {
            cJSON *usuario = cJSON_GetObjectItemCaseSensitive(json, "usuario");
            cJSON *direccionIP = cJSON_GetObjectItemCaseSensitive(json, "direccionIP");

            if (!usuario || !cJSON_IsString(usuario)) {
                cJSON *resp = cJSON_CreateObject();
                cJSON_AddStringToObject(resp, "respuesta", "ERROR");
                cJSON_AddStringToObject(resp, "razon", "Formato inválido en REGISTRO");
                enviar_JSON(client_socket, resp);
                cJSON_Delete(resp);
                return 0;
            }

            // Si no se proporciona direccionIP, asignar un valor predeterminado
            const char *ip = direccionIP && cJSON_IsString(direccionIP) ? direccionIP->valuestring : "0.0.0.0";

            // Verificar duplicados de nombre de usuario o dirección IP
            int nombre_duplicado = (find_client_by_username(usuario->valuestring) != NULL);
            int ip_duplicada = 0;

            for (int i = 0; i < client_count; i++) {
                if (clients[i].is_active && strncmp(clients[i].ip_address, ip, sizeof(clients[i].ip_address)) == 0) {
                    ip_duplicada = 1;
                    break;
                }
            }

            if (nombre_duplicado || ip_duplicada) {
                cJSON *resp = cJSON_CreateObject();
                cJSON_AddStringToObject(resp, "respuesta", "ERROR");
                cJSON_AddStringToObject(resp, "razon", ip_duplicada ? "IP_DUPLICADA" : "Nombre duplicado");
                enviar_JSON(client_socket, resp);
                cJSON_Delete(resp);
                return 0;
            }

            // Registro exitoso
            strncpy(client_info.username, usuario->valuestring, sizeof(client_info.username) - 1);
            client_info.username[sizeof(client_info.username) - 1] = '\0';

            strncpy(client_info.ip_address, ip, sizeof(client_info.ip_address) - 1);
            client_info.ip_address[sizeof(client_info.ip_address) - 1] = '\0';

            strncpy(client_info.estado, "ACTIVO", sizeof(client_info.estado) - 1);
            client_info.estado[sizeof(client_info.estado) - 1] = '\0';

            add_client(client_info);
            registered = 1;

            // Imprimir en la consola del servidor
            printf("Usuario registrado exitosamente: %s, IP: %s\n", client_info.username, client_info.ip_address);

            cJSON *resp = cJSON_CreateObject();
            cJSON_AddStringToObject(resp, "respuesta", "OK");
            enviar_JSON(client_socket, resp);
            cJSON_Delete(resp);
        
        

        } else if (tipo && strcmp(tipo->valuestring, "ESTADO") == 0) {
            cJSON *usuario = cJSON_GetObjectItemCaseSensitive(json, "usuario");
            cJSON *estado = cJSON_GetObjectItemCaseSensitive(json, "estado");
            
            if (!usuario || !estado || 
                !cJSON_IsString(usuario) || !cJSON_IsString(estado)) {
                cJSON *resp = cJSON_CreateObject();
                cJSON_AddStringToObject(resp, "respuesta", "ERROR");
                cJSON_AddStringToObject(resp, "razon", "Formato inválido en ESTADO");
                enviar_JSON(client_socket, resp);
                cJSON_Delete(resp);
            } else {
                // Buscar el cliente en la lista global y actualizar su estado
                Client *client = find_client_by_username(usuario->valuestring);
                if (client) {
                    if (strcmp(client->estado, estado->valuestring) == 0) {
                        cJSON *resp = cJSON_CreateObject();
                        cJSON_AddStringToObject(resp, "respuesta", "ERROR");
                        cJSON_AddStringToObject(resp, "razon", "ESTADO_YA_SELECCIONADO");
                        enviar_JSON(client_socket, resp);
                        cJSON_Delete(resp);
                    } else {
                        // Actualizar el estado del cliente en la lista global
                        strncpy(client->estado, estado->valuestring, sizeof(client->estado) - 1);
                        
                        cJSON *resp = cJSON_CreateObject();
                        cJSON_AddStringToObject(resp, "respuesta", "OK");
                        enviar_JSON(client_socket, resp);
                        cJSON_Delete(resp);
                    }
                } else {
                    cJSON *resp = cJSON_CreateObject();
                    cJSON_AddStringToObject(resp, "respuesta", "ERROR");
                    cJSON_AddStringToObject(resp, "razon", "USUARIO_NO_ENCONTRADO");
                    enviar_JSON(client_socket, resp);
                    cJSON_Delete(resp);
                }
            }
        }
        
        // Solicitud de MOSTRAR información de usuario
        else if (tipo && strcmp(tipo->valuestring, "MOSTRAR") == 0) {
            cJSON *usuario = cJSON_GetObjectItemCaseSensitive(json, "usuario");
            
            if (!usuario || !cJSON_IsString(usuario)) {
                cJSON *resp = cJSON_CreateObject();
                cJSON_AddStringToObject(resp, "respuesta", "ERROR");
                cJSON_AddStringToObject(resp, "razon", "Formato inválido en MOSTRAR");
                enviar_JSON(client_socket, resp);
                cJSON_Delete(resp);
            } else {
                Client *dest = find_client_by_username(usuario->valuestring);
                
                if (dest) {
                    cJSON *resp = cJSON_CreateObject();
                    cJSON_AddStringToObject(resp, "tipo", "MOSTRAR");
                    cJSON_AddStringToObject(resp, "usuario", dest->username);
                    cJSON_AddStringToObject(resp, "estado", dest->estado);
                    cJSON_AddStringToObject(resp, "direccionIP", dest->ip_address); 
                    enviar_JSON(client_socket, resp);
                    cJSON_Delete(resp);
                } else {
                    cJSON *resp = cJSON_CreateObject();
                    cJSON_AddStringToObject(resp, "respuesta", "ERROR");
                    cJSON_AddStringToObject(resp, "razon", "USUARIO_NO_ENCONTRADO");
                    enviar_JSON(client_socket, resp);
                    cJSON_Delete(resp);
                }
            }
        }

        else if (tipo && strcmp(tipo->valuestring, "EXIT") == 0) {
            cJSON *usuario = cJSON_GetObjectItemCaseSensitive(json, "usuario");
        
            if (usuario && cJSON_IsString(usuario)) {
                // Buscar el cliente en la lista global y marcarlo como inactivo
                Client *client = find_client_by_username(usuario->valuestring);
                if (client) {
                    client->is_active = 0;
                    printf("Usuario %s desconectado.\n", usuario->valuestring);
                } else {
                    printf("Usuario %s no encontrado para desconexión.\n", usuario->valuestring);
                }
            } else {
                printf("Formato inválido en mensaje EXIT.\n");
            }
        
            // Cerrar el socket después de procesar el mensaje EXIT
            remove_client(client_socket);
        #ifdef _WIN32
            closesocket(client_socket);
        #else
            close(client_socket);
        #endif
        }
          
        // Manejo de acciones como BROADCAST, DM, LISTA
        else if (accion && cJSON_IsString(accion)) {
            if (strcmp(accion->valuestring, "BROADCAST") == 0) {
                broadcast_message(buffer, NULL);
            }
            else if (strcmp(accion->valuestring, "DM") == 0) {
                cJSON *nombre_emisor = cJSON_GetObjectItemCaseSensitive(json, "nombre_emisor");
                cJSON *nombre_destinatario = cJSON_GetObjectItemCaseSensitive(json, "nombre_destinatario");
                cJSON *mensaje = cJSON_GetObjectItemCaseSensitive(json, "mensaje");
                
                if (nombre_emisor && nombre_destinatario && mensaje &&
                    cJSON_IsString(nombre_emisor) && cJSON_IsString(nombre_destinatario) && cJSON_IsString(mensaje)) {
                    send_direct_message(nombre_destinatario->valuestring, buffer, nombre_emisor->valuestring);
                }
            }
            else if (strcmp(accion->valuestring, "LISTA") == 0) {
                list_connected_users(client_socket);
            }
        }
        
        cJSON_Delete(json);
    }

    if (bytes_read == 0 || bytes_read == -1) {
        printf("Cliente desconectado inesperadamente.\n");
        remove_client(client_socket);
    }
    
    
#ifdef _WIN32
    closesocket(client_socket);
    return 0;
#else
    close(client_socket);
    return NULL;
#endif
}