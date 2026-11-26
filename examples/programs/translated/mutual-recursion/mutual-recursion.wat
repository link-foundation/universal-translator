;; Mutual recursion in WebAssembly text: the Hofstadter Female and Male sequences

(module
  (import "env" "print_integer" (func $print_integer (param i64)))
  (import "env" "print_text" (func $print_text (param i32 i32)))
  (import "env" "print_newline" (func $print_newline))
  (memory (export "memory") 256)
  (data (i32.const 0) ": ")
  (data (i32.const 2) " ")

  (func $female (param $index i64) (result i64)
    block $L2
    block $L1
    local.get $index
    i64.const 0
    i64.ne
    br_if $L1
    i64.const 1
    return
    br $L2
    end ;; L1
    end ;; L2
    local.get $index
    local.get $index
    i64.const 1
    i64.sub
    call $female
    call $male
    i64.sub
    return
  )

  (func $male (param $index i64) (result i64)
    block $L2
    block $L1
    local.get $index
    i64.const 0
    i64.ne
    br_if $L1
    i64.const 0
    return
    br $L2
    end ;; L1
    end ;; L2
    local.get $index
    local.get $index
    i64.const 1
    i64.sub
    call $male
    call $female
    i64.sub
    return
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
    i64.const 20
    i64.ge_s
    br_if $L2
    local.get $index
    call $print_integer
    i32.const 0
    i32.const 2
    call $print_text
    local.get $index
    call $female
    call $print_integer
    i32.const 2
    i32.const 1
    call $print_text
    local.get $index
    call $male
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
