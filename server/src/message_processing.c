#ifndef MESSAGE_PROCESSING_H
#define MESSAGE_PROCESSING_H

#include <json-c/json.h>

void handle_broadcast(struct json_object *msg);
void handle_dm(struct json_object *msg);
void handle_list_request(int sock);

#endif