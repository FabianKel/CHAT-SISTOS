#ifndef CLIENT_HANDLER_H
#define CLIENT_HANDLER_H

#include <json-c/json.h>

void *handle_client(void *socket_desc);
void handle_json_message(struct json_object *msg, int sock);

#endif