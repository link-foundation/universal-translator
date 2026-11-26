;; Greatest common divisor in WebAssembly text, using the Euclidean algorithm

(module
  (import "env" "print_integer" (func $print_integer (param i64)))
  (import "env" "print_text" (func $print_text (param i32 i32)))
  (import "env" "print_newline" (func $print_newline))
  (memory (export "memory") 256)
  (data (i32.const 0) "The greatest common divisor of 1071 and 462 is ")

  (func $greatest_common_divisor (param $first i64) (param $second i64) (result i64)
    (local $remainder i64)
    (local $.pc i32)
    loop $dispatch
    block $L2
    block $L1
    block $start
    local.get $.pc
    br_table $start $L1 $L2 $start
    end ;; start
    end ;; L1
    local.get $second
    i64.const 0
    i64.eq
    br_if $L2
    local.get $first
    local.get $second
    i64.rem_s
    local.set $remainder
    local.get $second
    local.set $first
    local.get $remainder
    local.set $second
    i32.const 1
    local.set $.pc
    br $dispatch
    end ;; L2
    local.get $first
    return
    end ;; dispatch
    unreachable
  )

  (func $main (export "main")
    i32.const 0
    i32.const 47
    call $print_text
    i64.const 1071
    i64.const 462
    call $greatest_common_divisor
    call $print_integer
    call $print_newline
    return
  )
)
