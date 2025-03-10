CC = gcc
CFLAGS = -Wall -Wextra -I../utils -ljson-c
LDFLAGS = -ljson-c
SRV_SRC = server.c
SRV_OBJ = $(SRV_SRC:.c=.o)
EXEC = server

all: $(EXEC)

$(EXEC): $(SRV_OBJ)
	$(CC) $^ -o $@ $(CFLAGS)

%.o: %.c
	$(CC) -c $< -o $@ $(CFLAGS)

clean:
	rm -f $(EXEC) *.o