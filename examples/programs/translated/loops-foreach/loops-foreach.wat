;; Loops/Foreach in WebAssembly text: print every element of a collection

(module
  (import "env" "print_integer" (func $print_integer (param i64)))
  (import "env" "print_text" (func $print_text (param i32 i32)))
  (import "env" "print_newline" (func $print_newline))
  (memory (export "memory") 256)
  (global $heap (mut i32) (i32.const 0))

  (func $main (export "main")
    (local $numbers i64)
    (local $index i64)
    (local $number i64)
    (local $.pc i32)
    (local $.dup i64)
    (local $.value i64)
    loop $dispatch
    block $L2
    block $L1
    block $start
    local.get $.pc
    br_table $start $L1 $L2 $start
    end ;; start
    i64.const 8
    i64.const 0
    call $new_array
    local.tee $.dup
    local.get $.dup
    i64.const 0
    i64.const 3
    i64.shl
    i64.const 1
    local.set $.value
    i64.add
    i32.wrap_i64
    local.get $.value
    i64.store
    local.tee $.dup
    local.get $.dup
    i64.const 1
    i64.const 3
    i64.shl
    i64.const 1
    local.set $.value
    i64.add
    i32.wrap_i64
    local.get $.value
    i64.store
    local.tee $.dup
    local.get $.dup
    i64.const 2
    i64.const 3
    i64.shl
    i64.const 2
    local.set $.value
    i64.add
    i32.wrap_i64
    local.get $.value
    i64.store
    local.tee $.dup
    local.get $.dup
    i64.const 3
    i64.const 3
    i64.shl
    i64.const 3
    local.set $.value
    i64.add
    i32.wrap_i64
    local.get $.value
    i64.store
    local.tee $.dup
    local.get $.dup
    i64.const 4
    i64.const 3
    i64.shl
    i64.const 5
    local.set $.value
    i64.add
    i32.wrap_i64
    local.get $.value
    i64.store
    local.tee $.dup
    local.get $.dup
    i64.const 5
    i64.const 3
    i64.shl
    i64.const 8
    local.set $.value
    i64.add
    i32.wrap_i64
    local.get $.value
    i64.store
    local.tee $.dup
    local.get $.dup
    i64.const 6
    i64.const 3
    i64.shl
    i64.const 13
    local.set $.value
    i64.add
    i32.wrap_i64
    local.get $.value
    i64.store
    local.tee $.dup
    local.get $.dup
    i64.const 7
    i64.const 3
    i64.shl
    i64.const 21
    local.set $.value
    i64.add
    i32.wrap_i64
    local.get $.value
    i64.store
    local.set $numbers
    i64.const 0
    local.set $index
    end ;; L1
    local.get $index
    local.get $numbers
    i64.const 8
    i64.sub
    i32.wrap_i64
    i64.load
    i64.ge_s
    br_if $L2
    local.get $numbers
    local.get $index
    i64.const 3
    i64.shl
    i64.add
    i32.wrap_i64
    i64.load
    local.set $number
    local.get $number
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

  (func $new_array (param $length i64) (param $fill i64) (result i64)
    (local $block i32)
    (local $index i64)
    global.get $heap
    local.set $block
    global.get $heap
    local.get $length
    i32.wrap_i64
    i32.const 3
    i32.shl
    i32.const 8
    i32.add
    i32.add
    global.set $heap
    local.get $block
    local.get $length
    i64.store
    loop $fill
      local.get $index
      local.get $length
      i64.lt_s
      if
        local.get $block
        local.get $index
        i32.wrap_i64
        i32.const 3
        i32.shl
        i32.add
        local.get $fill
        i64.store offset=8
        local.get $index
        i64.const 1
        i64.add
        local.set $index
        br $fill
      end
    end
    local.get $block
    i32.const 8
    i32.add
    i64.extend_i32_u
  )
)
