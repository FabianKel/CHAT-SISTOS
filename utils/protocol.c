#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <json-c/json.h>
#include "protocol.h"

char *create_json_message(const char *tipo, const char *usuario, const char *contenido) {
    struct json_object *json_msg = json_object_new_object();
    json_object_object_add(json_msg, "tipo", json_object_new_string(tipo));
    json_object_object_add(json_msg, "usuario", json_object_new_string(usuario));
    json_object_object_add(json_msg, "mensaje", json_object_new_string(contenido));

    const char *json_str = json_object_to_json_string(json_msg);
    char *result = strdup(json_str); // Copiar el string porque json-c lo libera
    json_object_put(json_msg);
    return result;
}

void process_message(const char *json_str, char *tipo, char *usuario, char *contenido) {
    struct json_object *parsed_json = json_tokener_parse(json_str);
    struct json_object *json_tipo, *json_usuario, *json_mensaje;

    if (json_object_object_get_ex(parsed_json, "tipo", &json_tipo)) {
        strcpy(tipo, json_object_get_string(json_tipo));
    }
    if (json_object_object_get_ex(parsed_json, "usuario", &json_usuario)) {
        strcpy(usuario, json_object_get_string(json_usuario));
    }
    if (json_object_object_get_ex(parsed_json, "mensaje", &json_mensaje)) {
        strcpy(contenido, json_object_get_string(json_mensaje));
    }

    json_object_put(parsed_json);
}
