;; Factorial in WebAssembly text, defined recursively

(module
  (import "env" "print_integer" (func $print_integer (param i64)))
  (import "env" "print_text" (func $print_text (param i32 i32)))
  (import "env" "print_newline" (func $print_newline))
  (memory (export "memory") 256)
  (data (i32.const 0) "! = ")

  (func $factorial (param $number i64) (result i64)
    block $L2
    block $L1
    local.get $number
    i64.const 1
    i64.gt_s
    br_if $L1
    i64.const 1
    return
    br $L2
    end ;; L1
    end ;; L2
    local.get $number
    local.get $number
    i64.const 1
    i64.sub
    call $factorial
    i64.mul
    return
  )

  (func $main (export "main")
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
    local.set $number
    end ;; L1
    local.get $number
    i64.const 11
    i64.ge_s
    br_if $L2
    local.get $number
    call $print_integer
    i32.const 0
    i32.const 4
    call $print_text
    local.get $number
    call $factorial
    call $print_integer
    call $print_newline
    local.get $number
    i64.const 1
    i64.add
    local.set $number
    i32.const 1
    local.set $.pc
    br $dispatch
    end ;; L2
    return
    end ;; dispatch
  )
)
