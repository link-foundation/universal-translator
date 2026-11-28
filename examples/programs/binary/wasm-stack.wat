(module
  (import "env" "print_integer" (func $print (param i64)))
  (import "env" "print_newline" (func $newline))

  (func $difference (param $first i64) (param $second i64) (result i64)
    local.get $first
    local.get $second
    i64.sub
    return)

  (func $report
    i64.const 9
    call $print
    call $newline)

  (func (export "main") (local $stored i64)
    local.get $stored
    i64.const 7
    local.set $stored
    call $print
    call $newline

    local.get $stored
    i64.const -130
    call $difference
    call $report
    call $print
    call $newline

    i64.const -7
    i64.const 2
    i64.div_s
    call $print
    call $newline
    i64.const -7
    i64.const 2
    i64.rem_s
    call $print
    call $newline
    i64.const -1
    i64.const 2
    i64.div_s
    call $print
    call $newline
    i64.const -1
    i64.const 0
    i64.mul
    call $print
    call $newline))
