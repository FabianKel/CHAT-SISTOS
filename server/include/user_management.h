#ifndef USER_MANAGEMENT_H
#define USER_MANAGEMENT_H

#define MAX_CLIENTS 10

typedef struct {
    int socket;
    char username[32];
    char ip_address[16];
    char estado[32];
} Client;

int register_client(int sock, const char *username, const char *ip);
void remove_client(int sock);
Client* find_user(const char *username);

#endif