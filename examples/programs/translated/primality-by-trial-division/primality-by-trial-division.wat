;; Primality by trial division in WebAssembly text

(module
  (import "env" "print_integer" (func $print_integer (param i64)))
  (import "env" "print_text" (func $print_text (param i32 i32)))
  (import "env" "print_newline" (func $print_newline))
  (memory (export "memory") 256)

  (func $is_prime (param $number i64) (result i64)
    (local $divisor i64)
    (local $.pc i32)
    loop $dispatch
    block $L4
    block $L6
    block $L5
    block $L3
    block $L2
    block $L1
    block $start
    local.get $.pc
    br_table $start $L1 $L2 $L3 $L5 $L6 $L4 $start
    end ;; start
    local.get $number
    i64.const 2
    i64.ge_s
    br_if $L1
    i64.const 0
    return
    br $L2
    end ;; L1
    end ;; L2
    i64.const 2
    local.set $divisor
    end ;; L3
    local.get $divisor
    local.get $divisor
    i64.mul
    local.get $number
    i64.gt_s
    br_if $L4
    local.get $number
    local.get $divisor
    i64.rem_s
    i64.const 0
    i64.ne
    br_if $L5
    i64.const 0
    return
    br $L6
    end ;; L5
    end ;; L6
    local.get $divisor
    i64.const 1
    i64.add
    local.set $divisor
    i32.const 3
    local.set $.pc
    br $dispatch
    end ;; L4
    i64.const 1
    return
    end ;; dispatch
    unreachable
  )

  (func $main (export "main")
    (local $number i64)
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
    i64.const 1
    local.set $number
    end ;; L1
    local.get $number
    i64.const 51
    i64.ge_s
    br_if $L2
    local.get $number
    call $is_prime
    i64.const 0
    i64.eq
    br_if $L3
    local.get $number
    call $print_integer
    call $print_newline
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
    return
    end ;; dispatch
  )
)
