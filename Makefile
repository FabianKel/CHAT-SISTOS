all:
	$(MAKE) -C server
	$(MAKE) -C client
	$(MAKE) -C utils

clean:
	$(MAKE) -C server clean
	$(MAKE) -C client clean
	$(MAKE) -C utils clean