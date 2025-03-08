all:
	make -C utils
	make -C server
	make -C client

clean:
	make -C utils clean
	make -C server clean
	make -C client clean
