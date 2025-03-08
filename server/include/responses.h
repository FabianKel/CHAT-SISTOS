#ifndef RESPONSES_H
#define RESPONSES_H

void send_success(int sock, const char *message);
void send_error(int sock, const char *reason);

#endif