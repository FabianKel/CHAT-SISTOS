CC = gcc
CFLAGS = -Wall -Wextra -fPIC -ljson-c
SRC = protocol.c
OBJ = $(SRC:.c=.o)
LIB = libprotocol.a

all: $(LIB)

$(LIB): $(OBJ)
	ar rcs $@ $^

%.o: %.c
	$(CC) -c $< -o $@ $(CFLAGS)

clean:
	rm -f $(LIB) *.o