;; Sum digits of an integer in WebAssembly text

(module
  (import "env" "print_integer" (func $print_integer (param i64)))
  (import "env" "print_text" (func $print_text (param i32 i32)))
  (import "env" "print_newline" (func $print_newline))
  (memory (export "memory") 256)
  (data (i32.const 0) "The digits of 1234567890 sum to ")

  (func $sum_of_digits (param $number i64) (result i64)
    (local $total i64)
    (local $.pc i32)
    loop $dispatch
    block $L2
    block $L1
    block $start
    local.get $.pc
    br_table $start $L1 $L2 $start
    end ;; start
    i64.const 0
    local.set $total
    end ;; L1
    local.get $number
    i64.const 0
    i64.le_s
    br_if $L2
    local.get $total
    local.get $number
    i64.const 10
    i64.rem_s
    i64.add
    local.set $total
    local.get $number
    i64.const 10
    i64.div_s
    local.set $number
    i32.const 1
    local.set $.pc
    br $dispatch
    end ;; L2
    local.get $total
    return
    end ;; dispatch
    unreachable
  )

  (func $main (export "main")
    i32.const 0
    i32.const 32
    call $print_text
    i64.const 1234567890
    call $sum_of_digits
    call $print_integer
    call $print_newline
    return
  )
)
