;; Towers of Hanoi in WebAssembly text, solved recursively

(module
  (import "env" "print_integer" (func $print_integer (param i64)))
  (import "env" "print_text" (func $print_text (param i32 i32)))
  (import "env" "print_newline" (func $print_newline))
  (memory (export "memory") 256)
  (data (i32.const 0) "Move disk ")
  (data (i32.const 10) " from ")
  (data (i32.const 16) " to ")

  (func $move_disks (param $count i64) (param $source i64) (param $target i64) (param $spare i64)
    block $L2
    block $L1
    local.get $count
    i64.const 0
    i64.ne
    br_if $L1
    return
    br $L2
    end ;; L1
    end ;; L2
    local.get $count
    i64.const 1
    i64.sub
    local.get $source
    local.get $spare
    local.get $target
    call $move_disks
    i32.const 0
    i32.const 10
    call $print_text
    local.get $count
    call $print_integer
    i32.const 10
    i32.const 6
    call $print_text
    local.get $source
    call $print_integer
    i32.const 16
    i32.const 4
    call $print_text
    local.get $target
    call $print_integer
    call $print_newline
    local.get $count
    i64.const 1
    i64.sub
    local.get $spare
    local.get $target
    local.get $source
    call $move_disks
    return
  )

  (func $main (export "main")
    i64.const 4
    i64.const 1
    i64.const 3
    i64.const 2
    call $move_disks
    return
  )
)
