# CMake generated Testfile for 
# Source directory: D:/Documentos/Septimo semestre/Sistos/CHAT-SISTO/cJSON
# Build directory: D:/Documentos/Septimo semestre/Sistos/CHAT-SISTO/cJSON/build_mingw
# 
# This file includes the relevant testing commands required for 
# testing this directory and lists subdirectories to be tested as well.
add_test(cJSON_test "D:/Documentos/Septimo semestre/Sistos/CHAT-SISTO/cJSON/build_mingw/cJSON_test")
set_tests_properties(cJSON_test PROPERTIES  _BACKTRACE_TRIPLES "D:/Documentos/Septimo semestre/Sistos/CHAT-SISTO/cJSON/CMakeLists.txt;248;add_test;D:/Documentos/Septimo semestre/Sistos/CHAT-SISTO/cJSON/CMakeLists.txt;0;")
subdirs("tests")
subdirs("fuzzing")
