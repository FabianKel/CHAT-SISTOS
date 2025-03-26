#----------------------------------------------------------------
# Generated CMake target import file.
#----------------------------------------------------------------

# Commands may need to know the format version.
set(CMAKE_IMPORT_FILE_VERSION 1)

# Import target "cjson" for configuration ""
set_property(TARGET cjson APPEND PROPERTY IMPORTED_CONFIGURATIONS NOCONFIG)
set_target_properties(cjson PROPERTIES
  IMPORTED_IMPLIB_NOCONFIG "C:/Program Files (x86)/cJSON/lib/libcjson.dll.a"
  IMPORTED_LOCATION_NOCONFIG "C:/Program Files (x86)/cJSON/bin/libcjson.dll"
  )

list(APPEND _cmake_import_check_targets cjson )
list(APPEND _cmake_import_check_files_for_cjson "C:/Program Files (x86)/cJSON/lib/libcjson.dll.a" "C:/Program Files (x86)/cJSON/bin/libcjson.dll" )

# Commands beyond this point should not need to know the version.
set(CMAKE_IMPORT_FILE_VERSION)
