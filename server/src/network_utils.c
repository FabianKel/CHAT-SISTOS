#include <unistd.h>
#include <pthread.h>
#include <arpa/inet.h>
#include "network_utils.h"
#include "client_handler.h"

int setup_server(int port) {
    int server_fd;
    struct sockaddr_in address = {
        .sin_family = AF_INET,
        .sin_addr.s_addr = INADDR_ANY,
        .sin_port = htons(port)
    };

    if ((server_fd = socket(AF_INET, SOCK_STREAM, 0)) < 0) return -1;
    if (bind(server_fd, (struct sockaddr*)&address, sizeof(address)) < 0) return -1;
    if (listen(server_fd, MAX_CLIENTS) < 0) return -1;
    
    return server_fd;
}

void accept_connections(int server_fd) {
    struct sockaddr_in client_addr;
    socklen_t addrlen = sizeof(client_addr);
    
    while (1) {
        int client_socket = accept(server_fd, (struct sockaddr*)&client_addr, &addrlen);
        if (client_socket < 0) continue;
        
        pthread_t thread_id;
        int *new_sock = malloc(sizeof(int));
        *new_sock = client_socket;
        pthread_create(&thread_id, NULL, handle_client, (void*)new_sock);
        pthread_detach(thread_id);
    }
}