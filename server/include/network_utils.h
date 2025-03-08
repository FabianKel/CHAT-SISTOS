#ifndef NETWORK_UTILS_H
#define NETWORK_UTILS_H

#define PORT 50213
#define MAX_CLIENTS 10

int setup_server(int port);
void accept_connections(int server_fd);

#endif