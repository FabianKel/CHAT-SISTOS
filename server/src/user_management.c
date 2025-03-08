// user_management.c (implementación corregida)
#include "user_management.h"
#include <string.h>
#include <pthread.h>

static Client *clients[MAX_CLIENTS];
pthread_mutex_t clients_mutex = PTHREAD_MUTEX_INITIALIZER;

int register_client(int sock, const char *username, const char *ip) {
    pthread_mutex_lock(&clients_mutex);
    
    // Verificar duplicados
    for (int i = 0; i < MAX_CLIENTS; i++) {
        if (clients[i] != NULL && 
            (strcmp(clients[i]->username, username) == 0 || 
             strcmp(clients[i]->ip_address, ip) == 0)) {
            pthread_mutex_unlock(&clients_mutex);
            return 0; // Error: usuario/IP duplicado
        }
    }
    
    // Registrar nuevo cliente
    for (int i = 0; i < MAX_CLIENTS; i++) {
        if (clients[i] == NULL) {
            clients[i] = malloc(sizeof(Client));
            clients[i]->socket = sock; // Usar parámetro 'sock'
            strncpy(clients[i]->username, username, 32); // Usar 'username'
            strncpy(clients[i]->ip_address, ip, 16); // Usar 'ip'
            memset(clients[i]->estado, 0, 32);
            pthread_mutex_unlock(&clients_mutex);
            return 1; // Éxito
        }
    }
    
    pthread_mutex_unlock(&clients_mutex);
    return 0; // No hay espacio
}
// user_management.c (funciones adicionales)
void remove_client(int sock) {
    pthread_mutex_lock(&clients_mutex);
    for (int i = 0; i < MAX_CLIENTS; i++) {
        if (clients[i] != NULL && clients[i]->socket == sock) {
            free(clients[i]);
            clients[i] = NULL;
            break;
        }
    }
    pthread_mutex_unlock(&clients_mutex);
}

Client* find_user(const char *username) {
    pthread_mutex_lock(&clients_mutex);
    for (int i = 0; i < MAX_CLIENTS; i++) {
        if (clients[i] != NULL && strcmp(clients[i]->username, username) == 0) {
            pthread_mutex_unlock(&clients_mutex);
            return clients[i];
        }
    }
    pthread_mutex_unlock(&clients_mutex);
    return NULL;
}