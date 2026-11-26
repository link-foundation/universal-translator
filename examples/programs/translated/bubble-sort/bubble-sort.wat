;; Bubble sort in WebAssembly text: sort a list of numbers

(module
  (import "env" "print_integer" (func $print_integer (param i64)))
  (import "env" "print_text" (func $print_text (param i32 i32)))
  (import "env" "print_newline" (func $print_newline))
  (memory (export "memory") 256)
  (global $heap (mut i32) (i32.const 0))

  (func $main (export "main")
    (local $numbers i64)
    (local $count i64)
    (local $pass i64)
    (local $index i64)
    (local $swap i64)
    (local $position i64)
    (local $.pc i32)
    (local $.dup i64)
    (local $.value i64)
    loop $dispatch
    block $L8
    block $L7
    block $L2
    block $L4
    block $L6
    block $L5
    block $L3
    block $L1
    block $start
    local.get $.pc
    br_table $start $L1 $L3 $L5 $L6 $L4 $L2 $L7 $L8 $start
    end ;; start
    i64.const 7
    i64.const 0
    call $new_array
    local.tee $.dup
    local.get $.dup
    i64.const 0
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
    i64.const 1
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
    i64.const 2
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
    i64.const 3
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
    i64.const 4
    i64.const 3
    i64.shl
    i64.const 9
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
    i64.const 2
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
    i64.const 7
    local.set $.value
    i64.add
    i32.wrap_i64
    local.get $.value
    i64.store
    local.set $numbers
    local.get $numbers
    i64.const 8
    i64.sub
    i32.wrap_i64
    i64.load
    local.set $count
    i64.const 0
    local.set $pass
    end ;; L1
    local.get $pass
    local.get $count
    i64.const 1
    i64.sub
    i64.ge_s
    br_if $L2
    i64.const 0
    local.set $index
    end ;; L3
    local.get $index
    local.get $count
    i64.const 1
    i64.sub
    local.get $pass
    i64.sub
    i64.ge_s
    br_if $L4
    local.get $numbers
    local.get $index
    i64.const 3
    i64.shl
    i64.add
    i32.wrap_i64
    i64.load
    local.get $numbers
    local.get $index
    i64.const 1
    i64.add
    i64.const 3
    i64.shl
    i64.add
    i32.wrap_i64
    i64.load
    i64.le_s
    br_if $L5
    local.get $numbers
    local.get $index
    i64.const 3
    i64.shl
    i64.add
    i32.wrap_i64
    i64.load
    local.set $swap
    local.get $numbers
    local.get $index
    i64.const 3
    i64.shl
    local.get $numbers
    local.get $index
    i64.const 1
    i64.add
    i64.const 3
    i64.shl
    i64.add
    i32.wrap_i64
    i64.load
    local.set $.value
    i64.add
    i32.wrap_i64
    local.get $.value
    i64.store
    local.get $numbers
    local.get $index
    i64.const 1
    i64.add
    i64.const 3
    i64.shl
    local.get $swap
    local.set $.value
    i64.add
    i32.wrap_i64
    local.get $.value
    i64.store
    br $L6
    end ;; L5
    end ;; L6
    local.get $index
    i64.const 1
    i64.add
    local.set $index
    i32.const 2
    local.set $.pc
    br $dispatch
    end ;; L4
    local.get $pass
    i64.const 1
    i64.add
    local.set $pass
    i32.const 1
    local.set $.pc
    br $dispatch
    end ;; L2
    i64.const 0
    local.set $position
    end ;; L7
    local.get $position
    local.get $count
    i64.ge_s
    br_if $L8
    local.get $numbers
    local.get $position
    i64.const 3
    i64.shl
    i64.add
    i32.wrap_i64
    i64.load
    call $print_integer
    call $print_newline
    local.get $position
    i64.const 1
    i64.add
    local.set $position
    i32.const 7
    local.set $.pc
    br $dispatch
    end ;; L8
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
