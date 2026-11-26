;; Fibonacci sequence in WebAssembly text, computed iteratively

(module
  (import "env" "print_integer" (func $print_integer (param i64)))
  (import "env" "print_text" (func $print_text (param i32 i32)))
  (import "env" "print_newline" (func $print_newline))
  (memory (export "memory") 256)
  (data (i32.const 0) "fibonacci(")
  (data (i32.const 10) ") = ")

  (func $fibonacci (param $count i64) (result i64)
    (local $previous i64)
    (local $current i64)
    (local $step i64)
    (local $next i64)
    (local $.pc i32)
    loop $dispatch
    block $L2
    block $L1
    block $start
    local.get $.pc
    br_table $start $L1 $L2 $start
    end ;; start
    i64.const 0
    local.set $previous
    i64.const 1
    local.set $current
    i64.const 0
    local.set $step
    end ;; L1
    local.get $step
    local.get $count
    i64.ge_s
    br_if $L2
    local.get $previous
    local.get $current
    i64.add
    local.set $next
    local.get $current
    local.set $previous
    local.get $next
    local.set $current
    local.get $step
    i64.const 1
    i64.add
    local.set $step
    i32.const 1
    local.set $.pc
    br $dispatch
    end ;; L2
    local.get $previous
    return
    end ;; dispatch
    unreachable
  )

  (func $main (export "main")
    (local $index i64)
    (local $.pc i32)
    loop $dispatch
    block $L2
    block $L1
    block $start
    local.get $.pc
    br_table $start $L1 $L2 $start
    end ;; start
    i64.const 0
    local.set $index
    end ;; L1
    local.get $index
    i64.const 21
    i64.ge_s
    br_if $L2
    i32.const 0
    i32.const 10
    call $print_text
    local.get $index
    call $print_integer
    i32.const 10
    i32.const 4
    call $print_text
    local.get $index
    call $fibonacci
    call $print_integer
    call $print_newline
    local.get $index
    i64.const 1
    i64.add
    local.set $index
    i32.const 1
    local.set $.pc
    br $dispatch
    end ;; L2
    return
    end ;; dispatch
  )
)
