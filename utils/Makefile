CC=gcc
CFLAGS=-Wall
LIBS=-ljson-c

all: protocol.o

protocol.o: protocol.c protocol.h
	$(CC) -c protocol.c $(CFLAGS)

clean:
	rm -f *.o
