;; Sum of squares in WebAssembly text

(module
  (import "env" "print_integer" (func $print_integer (param i64)))
  (import "env" "print_text" (func $print_text (param i32 i32)))
  (import "env" "print_newline" (func $print_newline))
  (memory (export "memory") 256)
  (data (i32.const 0) "Sum of squares from 1 to ")
  (data (i32.const 25) ":")

  (func $sum_of_squares (param $limit i64) (result i64)
    (local $total i64)
    (local $number i64)
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
    i64.const 1
    local.set $number
    end ;; L1
    local.get $number
    local.get $limit
    i64.gt_s
    br_if $L2
    local.get $total
    local.get $number
    local.get $number
    i64.mul
    i64.add
    local.set $total
    local.get $number
    i64.const 1
    i64.add
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
    (local $limit i64)
    i64.const 10
    local.set $limit
    i32.const 0
    i32.const 25
    call $print_text
    local.get $limit
    call $print_integer
    i32.const 25
    i32.const 1
    call $print_text
    call $print_newline
    local.get $limit
    call $sum_of_squares
    call $print_integer
    call $print_newline
    return
  )
)
