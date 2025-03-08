#ifndef PROTOCOL_H
#define PROTOCOL_H

void create_json_message(const char *message, char *output);
void process_message(const char *message, int client_sock);

#endif
