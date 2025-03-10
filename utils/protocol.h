#ifndef PROTOCOL_H
#define PROTOCOL_H

char *create_json_message(const char *tipo, const char *usuario, const char *contenido);
void process_message(const char *json_str, char *tipo, char *usuario, char *contenido);

#endif