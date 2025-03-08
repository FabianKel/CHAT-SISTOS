#include <stdio.h>
#include <string.h>
#include <json-c/json.h>
#include "protocol.h"

void create_json_message(const char *message, char *output) {
    struct json_object *json_msg = json_object_new_object();
    json_object_object_add(json_msg, "tipo", json_object_new_string(message));
    strcpy(output, json_object_to_json_string(json_msg));
}

void process_message(const char *message, int client_sock) {
    struct json_object *parsed_json = json_tokener_parse(message);
    struct json_object *tipo;
    json_object_object_get_ex(parsed_json, "tipo", &tipo);
    printf("Mensaje recibido: %s\n", json_object_get_string(tipo));
}
