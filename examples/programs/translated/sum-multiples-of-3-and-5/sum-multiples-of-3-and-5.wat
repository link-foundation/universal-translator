;; Sum multiples of 3 and 5 in WebAssembly text: the sum of the multiples below 1000

(module
  (import "env" "print_integer" (func $print_integer (param i64)))
  (import "env" "print_text" (func $print_text (param i32 i32)))
  (import "env" "print_newline" (func $print_newline))
  (memory (export "memory") 256)

  (func $main (export "main")
    (local $total i64)
    (local $number i64)
    (local $.pc i32)
    loop $dispatch
    block $L2
    block $L4
    block $L3
    block $L5
    block $L1
    block $start
    local.get $.pc
    br_table $start $L1 $L5 $L3 $L4 $L2 $start
    end ;; start
    i64.const 0
    local.set $total
    i64.const 1
    local.set $number
    end ;; L1
    local.get $number
    i64.const 1000
    i64.ge_s
    br_if $L2
    local.get $number
    i64.const 3
    i64.rem_s
    i64.const 0
    i64.eq
    br_if $L5
    local.get $number
    i64.const 5
    i64.rem_s
    i64.const 0
    i64.ne
    br_if $L3
    end ;; L5
    local.get $total
    local.get $number
    i64.add
    local.set $total
    br $L4
    end ;; L3
    end ;; L4
    local.get $number
    i64.const 1
    i64.add
    local.set $number
    i32.const 1
    local.set $.pc
    br $dispatch
    end ;; L2
    local.get $total
    call $print_integer
    call $print_newline
    return
    end ;; dispatch
  )
)
