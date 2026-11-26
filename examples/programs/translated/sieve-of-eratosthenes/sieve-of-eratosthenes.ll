; Sieve of Eratosthenes in LLVM IR: the primes up to 100

declare i32 @printf(ptr, ...)
declare ptr @malloc(i64)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"

define i32 @main() {
entry.0:
  %limit.addr = alloca i64
  %is_prime.addr = alloca ptr
  %number.addr = alloca i64
  %multiple.addr = alloca i64
  store i64 100, ptr %limit.addr
  %t.1 = load i64, ptr %limit.addr
  %t.2 = add i64 %t.1, 1
  %t.3 = call ptr @new_array(i64 %t.2, i64 1)
  store ptr %t.3, ptr %is_prime.addr
  %t.4 = load ptr, ptr %is_prime.addr
  %t.5 = getelementptr i64, ptr %t.4, i64 0
  store i64 0, ptr %t.5
  %t.6 = load ptr, ptr %is_prime.addr
  %t.7 = getelementptr i64, ptr %t.6, i64 1
  store i64 0, ptr %t.7
  store i64 2, ptr %number.addr
  br label %L1
L1:
  %t.8 = load i64, ptr %number.addr
  %t.9 = load i64, ptr %limit.addr
  %t.10 = add i64 %t.9, 1
  %t.11 = icmp sge i64 %t.8, %t.10
  br i1 %t.11, label %L2, label %next.1
next.1:
  %t.12 = load ptr, ptr %is_prime.addr
  %t.13 = load i64, ptr %number.addr
  %t.14 = getelementptr i64, ptr %t.12, i64 %t.13
  %t.15 = load i64, ptr %t.14
  %t.16 = icmp ne i64 %t.15, 1
  br i1 %t.16, label %L3, label %next.2
next.2:
  %t.17 = load i64, ptr %number.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.17)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  %t.18 = load i64, ptr %number.addr
  %t.19 = load i64, ptr %number.addr
  %t.20 = mul i64 %t.18, %t.19
  store i64 %t.20, ptr %multiple.addr
  br label %L5
L5:
  %t.21 = load i64, ptr %multiple.addr
  %t.22 = load i64, ptr %limit.addr
  %t.23 = icmp sgt i64 %t.21, %t.22
  br i1 %t.23, label %L6, label %next.3
next.3:
  %t.24 = load ptr, ptr %is_prime.addr
  %t.25 = load i64, ptr %multiple.addr
  %t.26 = getelementptr i64, ptr %t.24, i64 %t.25
  store i64 0, ptr %t.26
  %t.27 = load i64, ptr %multiple.addr
  %t.28 = load i64, ptr %number.addr
  %t.29 = add i64 %t.27, %t.28
  store i64 %t.29, ptr %multiple.addr
  br label %L5
L6:
  br label %L4
L3:
  br label %L4
L4:
  %t.30 = load i64, ptr %number.addr
  %t.31 = add i64 %t.30, 1
  store i64 %t.31, ptr %number.addr
  br label %L1
L2:
  ret i32 0
}

define private ptr @new_array(i64 %length, i64 %fill) {
entry.0:
  %bytes = shl i64 %length, 3
  %size = add i64 %bytes, 8
  %block = call ptr @malloc(i64 %size)
  store i64 %length, ptr %block
  %elements = getelementptr i64, ptr %block, i64 1
  br label %fill.test
fill.test:
  %index = phi i64 [ 0, %entry.0 ], [ %next, %fill.body ]
  %more = icmp slt i64 %index, %length
  br i1 %more, label %fill.body, label %fill.done
fill.body:
  %address = getelementptr i64, ptr %elements, i64 %index
  store i64 %fill, ptr %address
  %next = add i64 %index, 1
  br label %fill.test
fill.done:
  ret ptr %elements
}
