;; Ackermann function in WebAssembly text, defined recursively

(module
  (import "env" "print_integer" (func $print_integer (param i64)))
  (import "env" "print_text" (func $print_text (param i32 i32)))
  (import "env" "print_newline" (func $print_newline))
  (memory (export "memory") 256)
  (data (i32.const 0) "ackermann(")
  (data (i32.const 10) ", ")
  (data (i32.const 12) ") = ")

  (func $ackermann (param $first i64) (param $second i64) (result i64)
    block $L4
    block $L3
    block $L2
    block $L1
    local.get $first
    i64.const 0
    i64.ne
    br_if $L1
    local.get $second
    i64.const 1
    i64.add
    return
    br $L2
    end ;; L1
    end ;; L2
    local.get $second
    i64.const 0
    i64.ne
    br_if $L3
    local.get $first
    i64.const 1
    i64.sub
    i64.const 1
    call $ackermann
    return
    br $L4
    end ;; L3
    end ;; L4
    local.get $first
    i64.const 1
    i64.sub
    local.get $first
    local.get $second
    i64.const 1
    i64.sub
    call $ackermann
    call $ackermann
    return
  )

  (func $main (export "main")
    (local $first i64)
    (local $second i64)
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
    local.set $first
    end ;; L1
    local.get $first
    i64.const 4
    i64.ge_s
    br_if $L2
    i64.const 0
    local.set $second
    end ;; L3
    local.get $second
    i64.const 5
    i64.ge_s
    br_if $L4
    i32.const 0
    i32.const 10
    call $print_text
    local.get $first
    call $print_integer
    i32.const 10
    i32.const 2
    call $print_text
    local.get $second
    call $print_integer
    i32.const 12
    i32.const 4
    call $print_text
    local.get $first
    local.get $second
    call $ackermann
    call $print_integer
    call $print_newline
    local.get $second
    i64.const 1
    i64.add
    local.set $second
    i32.const 2
    local.set $.pc
    br $dispatch
    end ;; L4
    local.get $first
    i64.const 1
    i64.add
    local.set $first
    i32.const 1
    local.set $.pc
    br $dispatch
    end ;; L2
    return
    end ;; dispatch
  )
)
