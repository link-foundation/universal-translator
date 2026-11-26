;; Hailstone sequence in WebAssembly text: count the steps to reach 1

(module
  (import "env" "print_integer" (func $print_integer (param i64)))
  (import "env" "print_text" (func $print_text (param i32 i32)))
  (import "env" "print_newline" (func $print_newline))
  (memory (export "memory") 256)
  (data (i32.const 0) " takes ")
  (data (i32.const 7) " steps")

  (func $hailstone_steps (param $number i64) (result i64)
    (local $steps i64)
    (local $.pc i32)
    loop $dispatch
    block $L2
    block $L4
    block $L3
    block $L1
    block $start
    local.get $.pc
    br_table $start $L1 $L3 $L4 $L2 $start
    end ;; start
    i64.const 0
    local.set $steps
    end ;; L1
    local.get $number
    i64.const 1
    i64.eq
    br_if $L2
    local.get $number
    i64.const 2
    i64.rem_s
    i64.const 0
    i64.ne
    br_if $L3
    local.get $number
    i64.const 2
    i64.div_s
    local.set $number
    br $L4
    end ;; L3
    i64.const 3
    local.get $number
    i64.mul
    i64.const 1
    i64.add
    local.set $number
    end ;; L4
    local.get $steps
    i64.const 1
    i64.add
    local.set $steps
    i32.const 1
    local.set $.pc
    br $dispatch
    end ;; L2
    local.get $steps
    return
    end ;; dispatch
    unreachable
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
    i64.const 1
    local.set $number
    end ;; L1
    local.get $number
    i64.const 11
    i64.ge_s
    br_if $L2
    local.get $number
    call $print_integer
    i32.const 0
    i32.const 7
    call $print_text
    local.get $number
    call $hailstone_steps
    call $print_integer
    i32.const 7
    i32.const 6
    call $print_text
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
