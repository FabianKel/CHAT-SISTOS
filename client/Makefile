CC = gcc
CFLAGS = -Wall -Wextra -I../utils -ljson-c
CLIENT_SRC = client.c
CLIENT_OBJ = $(CLIENT_SRC:.c=.o)
EXEC = client

all: $(EXEC)

$(EXEC): $(CLIENT_OBJ)
	$(CC) $^ -o $@ $(CFLAGS)

%.o: %.c
	$(CC) -c $< -o $@ $(CFLAGS)

clean:
	rm -f $(EXEC) *.o