;; Leap year in WebAssembly text

(module
  (import "env" "print_integer" (func $print_integer (param i64)))
  (import "env" "print_text" (func $print_text (param i32 i32)))
  (import "env" "print_newline" (func $print_newline))
  (memory (export "memory") 256)
  (data (i32.const 0) " is a leap year")
  (data (i32.const 15) " is not a leap year")

  (func $is_leap_year (param $year i64) (result i64)
    (local $.stack.0 i64)
    block $L2
    block $L1
    block $L3
    block $L4
    local.get $year
    i64.const 4
    i64.rem_s
    i64.const 0
    i64.ne
    br_if $L4
    local.get $year
    i64.const 100
    i64.rem_s
    i64.const 0
    i64.ne
    br_if $L3
    end ;; L4
    local.get $year
    i64.const 400
    i64.rem_s
    i64.const 0
    i64.ne
    br_if $L1
    end ;; L3
    i64.const 1
    local.set $.stack.0
    br $L2
    end ;; L1
    i64.const 0
    local.set $.stack.0
    end ;; L2
    local.get $.stack.0
    return
  )

  (func $main (export "main")
    (local $year i64)
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
    i64.const 1896
    local.set $year
    end ;; L1
    local.get $year
    i64.const 1913
    i64.ge_s
    br_if $L2
    local.get $year
    call $is_leap_year
    i64.const 0
    i64.eq
    br_if $L3
    local.get $year
    call $print_integer
    i32.const 0
    i32.const 15
    call $print_text
    call $print_newline
    br $L4
    end ;; L3
    local.get $year
    call $print_integer
    i32.const 15
    i32.const 19
    call $print_text
    call $print_newline
    end ;; L4
    local.get $year
    i64.const 1
    i64.add
    local.set $year
    i32.const 1
    local.set $.pc
    br $dispatch
    end ;; L2
    return
    end ;; dispatch
  )
)
