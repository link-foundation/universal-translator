;; Sieve of Eratosthenes in WebAssembly text: the primes up to 100

(module
  (import "env" "print_integer" (func $print_integer (param i64)))
  (import "env" "print_text" (func $print_text (param i32 i32)))
  (import "env" "print_newline" (func $print_newline))
  (memory (export "memory") 256)
  (global $heap (mut i32) (i32.const 0))

  (func $main (export "main")
    (local $limit i64)
    (local $is_prime i64)
    (local $number i64)
    (local $multiple i64)
    (local $.pc i32)
    (local $.value i64)
    loop $dispatch
    block $L2
    block $L4
    block $L3
    block $L6
    block $L5
    block $L1
    block $start
    local.get $.pc
    br_table $start $L1 $L5 $L6 $L3 $L4 $L2 $start
    end ;; start
    i64.const 100
    local.set $limit
    local.get $limit
    i64.const 1
    i64.add
    i64.const 1
    call $new_array
    local.set $is_prime
    local.get $is_prime
    i64.const 0
    i64.const 3
    i64.shl
    i64.const 0
    local.set $.value
    i64.add
    i32.wrap_i64
    local.get $.value
    i64.store
    local.get $is_prime
    i64.const 1
    i64.const 3
    i64.shl
    i64.const 0
    local.set $.value
    i64.add
    i32.wrap_i64
    local.get $.value
    i64.store
    i64.const 2
    local.set $number
    end ;; L1
    local.get $number
    local.get $limit
    i64.const 1
    i64.add
    i64.ge_s
    br_if $L2
    local.get $is_prime
    local.get $number
    i64.const 3
    i64.shl
    i64.add
    i32.wrap_i64
    i64.load
    i64.const 1
    i64.ne
    br_if $L3
    local.get $number
    call $print_integer
    call $print_newline
    local.get $number
    local.get $number
    i64.mul
    local.set $multiple
    end ;; L5
    local.get $multiple
    local.get $limit
    i64.gt_s
    br_if $L6
    local.get $is_prime
    local.get $multiple
    i64.const 3
    i64.shl
    i64.const 0
    local.set $.value
    i64.add
    i32.wrap_i64
    local.get $.value
    i64.store
    local.get $multiple
    local.get $number
    i64.add
    local.set $multiple
    i32.const 2
    local.set $.pc
    br $dispatch
    end ;; L6
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
