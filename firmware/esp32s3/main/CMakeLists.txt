idf_component_register(
  SRCS "app_main.c" "../../infer.c"
  INCLUDE_DIRS "." "../.."
)
target_compile_definitions(${COMPONENT_LIB} PRIVATE E2E_NO_MAIN=1)
