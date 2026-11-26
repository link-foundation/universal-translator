;; FizzBuzz in WebAssembly text

(module
  (import "env" "print_integer" (func $print_integer (param i64)))
  (import "env" "print_text" (func $print_text (param i32 i32)))
  (import "env" "print_newline" (func $print_newline))
  (memory (export "memory") 256)
  (data (i32.const 0) "FizzBuzz")
  (data (i32.const 8) "Fizz")
  (data (i32.const 12) "Buzz")

  (func $main (export "main")
    (local $number i64)
    (local $.pc i32)
    loop $dispatch
    block $L2
    block $L4
    block $L6
    block $L8
    block $L7
    block $L5
    block $L3
    block $L1
    block $start
    local.get $.pc
    br_table $start $L1 $L3 $L5 $L7 $L8 $L6 $L4 $L2 $start
    end ;; start
    i64.const 1
    local.set $number
    end ;; L1
    local.get $number
    i64.const 101
    i64.ge_s
    br_if $L2
    local.get $number
    i64.const 15
    i64.rem_s
    i64.const 0
    i64.ne
    br_if $L3
    i32.const 0
    i32.const 8
    call $print_text
    call $print_newline
    br $L4
    end ;; L3
    local.get $number
    i64.const 3
    i64.rem_s
    i64.const 0
    i64.ne
    br_if $L5
    i32.const 8
    i32.const 4
    call $print_text
    call $print_newline
    br $L6
    end ;; L5
    local.get $number
    i64.const 5
    i64.rem_s
    i64.const 0
    i64.ne
    br_if $L7
    i32.const 12
    i32.const 4
    call $print_text
    call $print_newline
    br $L8
    end ;; L7
    local.get $number
    call $print_integer
    call $print_newline
    end ;; L8
    end ;; L6
    end ;; L4
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
