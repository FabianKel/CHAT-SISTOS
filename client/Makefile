CC=gcc
CFLAGS=-Wall -I../utils
LIBS=-ljson-c -lncurses

client: client.o ../utils/protocol.o
	$(CC) -o client client.o ../utils/protocol.o $(LIBS)

client.o: client.c
	$(CC) -c client.c $(CFLAGS)

clean:
	rm -f *.o client

