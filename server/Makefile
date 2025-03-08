CC = gcc
CFLAGS = -Wall -Wextra -I../utils -Iinclude
LIBS = -ljson-c -lpthread
SRC_DIR = src
OBJ_DIR = obj

SOURCES = $(wildcard $(SRC_DIR)/*.c)
OBJECTS = $(patsubst $(SRC_DIR)/%.c,$(OBJ_DIR)/%.o,$(SOURCES))
UTILS_OBJ = ../utils/protocol.o

all: create_dirs server

server: $(OBJECTS) $(UTILS_OBJ)
	$(CC) -o $@ $^ $(LIBS)

$(OBJ_DIR)/%.o: $(SRC_DIR)/%.c
	$(CC) $(CFLAGS) -c -o $@ $<

create_dirs:
	mkdir -p $(OBJ_DIR)

clean:
	rm -rf $(OBJ_DIR) server

.PHONY: all clean create_dirs