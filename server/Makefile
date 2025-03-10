CC = gcc
CFLAGS = -Wall -Wextra -I../utils -pthread -ljson-c
LDFLAGS = -ljson-c
SRV_SRC = server.c server_utils.c
SRV_OBJ = $(SRV_SRC:.c=.o)
EXEC = server

all: $(EXEC)

$(EXEC): $(SRV_OBJ)
	$(CC) $^ -o $@ $(CFLAGS)

%.o: %.c
	$(CC) -c $< -o $@ $(CFLAGS)

clean:
	rm -f $(EXEC) *.o