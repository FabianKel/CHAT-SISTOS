#include <stdio.h>
#include <stdlib.h>
#include <arpa/inet.h>
#include "network_utils.h"

int main() {
    int server_fd = setup_server(PORT);
    if (server_fd < 0) return 1;
    
    printf("Servidor en ejecución en el puerto %d...\n", PORT);
    accept_connections(server_fd);
    
    close(server_fd);
    return 0;
}