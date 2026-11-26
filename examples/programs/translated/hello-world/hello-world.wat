;; Hello World in WebAssembly text

(module
  (import "env" "print_integer" (func $print_integer (param i64)))
  (import "env" "print_text" (func $print_text (param i32 i32)))
  (import "env" "print_newline" (func $print_newline))
  (memory (export "memory") 256)
  (data (i32.const 0) "Hello World!")

  (func $main (export "main")
    ;; print "Hello World!" into console followed by new line symbol by call instruction
    i32.const 0
    i32.const 12
    call $print_text
    call $print_newline
    return
  )
)
