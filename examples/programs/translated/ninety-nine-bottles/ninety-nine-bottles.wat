;; 99 bottles of beer in WebAssembly text

(module
  (import "env" "print_integer" (func $print_integer (param i64)))
  (import "env" "print_text" (func $print_text (param i32 i32)))
  (import "env" "print_newline" (func $print_newline))
  (memory (export "memory") 256)
  (data (i32.const 0) " bottles of beer on the wall, ")
  (data (i32.const 30) " bottles of beer.")
  (data (i32.const 47) "Take one down and pass it around, ")
  (data (i32.const 81) " bottles of beer on the wall.")

  (func $main (export "main")
    (local $bottles i64)
    (local $.pc i32)
    loop $dispatch
    block $L2
    block $L1
    block $start
    local.get $.pc
    br_table $start $L1 $L2 $start
    end ;; start
    i64.const 99
    local.set $bottles
    end ;; L1
    local.get $bottles
    i64.const 0
    i64.le_s
    br_if $L2
    local.get $bottles
    call $print_integer
    i32.const 0
    i32.const 30
    call $print_text
    local.get $bottles
    call $print_integer
    i32.const 30
    i32.const 17
    call $print_text
    call $print_newline
    i32.const 47
    i32.const 34
    call $print_text
    local.get $bottles
    i64.const 1
    i64.sub
    call $print_integer
    i32.const 81
    i32.const 29
    call $print_text
    call $print_newline
    local.get $bottles
    i64.const 1
    i64.sub
    local.set $bottles
    i32.const 1
    local.set $.pc
    br $dispatch
    end ;; L2
    return
    end ;; dispatch
  )
)
