; Perfect numbers in LLVM IR: numbers equal to the sum of their divisors

declare i32 @printf(ptr, ...)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"

define i64 @is_perfect(i64 %number) {
entry.0:
  %number.addr = alloca i64
  %sum.addr = alloca i64
  %divisor.addr = alloca i64
  %stack.0 = alloca i64
  store i64 %number, ptr %number.addr
  store i64 1, ptr %sum.addr
  store i64 2, ptr %divisor.addr
  br label %L1
L1:
  %t.1 = load i64, ptr %divisor.addr
  %t.2 = load i64, ptr %divisor.addr
  %t.3 = mul i64 %t.1, %t.2
  %t.4 = load i64, ptr %number.addr
  %t.5 = icmp sgt i64 %t.3, %t.4
  br i1 %t.5, label %L2, label %next.1
next.1:
  %t.6 = load i64, ptr %number.addr
  %t.7 = load i64, ptr %divisor.addr
  %t.8 = srem i64 %t.6, %t.7
  %t.9 = icmp ne i64 %t.8, 0
  br i1 %t.9, label %L3, label %next.2
next.2:
  %t.10 = load i64, ptr %sum.addr
  %t.11 = load i64, ptr %divisor.addr
  %t.12 = add i64 %t.10, %t.11
  store i64 %t.12, ptr %sum.addr
  %t.13 = load i64, ptr %divisor.addr
  %t.14 = load i64, ptr %divisor.addr
  %t.15 = mul i64 %t.13, %t.14
  %t.16 = load i64, ptr %number.addr
  %t.17 = icmp eq i64 %t.15, %t.16
  br i1 %t.17, label %L5, label %next.3
next.3:
  %t.18 = load i64, ptr %sum.addr
  %t.19 = load i64, ptr %number.addr
  %t.20 = load i64, ptr %divisor.addr
  %t.21 = sdiv i64 %t.19, %t.20
  %t.22 = add i64 %t.18, %t.21
  store i64 %t.22, ptr %sum.addr
  br label %L6
L5:
  br label %L6
L6:
  br label %L4
L3:
  br label %L4
L4:
  %t.23 = load i64, ptr %divisor.addr
  %t.24 = add i64 %t.23, 1
  store i64 %t.24, ptr %divisor.addr
  br label %L1
L2:
  %t.25 = load i64, ptr %number.addr
  %t.26 = icmp sle i64 %t.25, 1
  br i1 %t.26, label %L7, label %next.4
next.4:
  %t.27 = load i64, ptr %sum.addr
  %t.28 = load i64, ptr %number.addr
  %t.29 = icmp ne i64 %t.27, %t.28
  br i1 %t.29, label %L7, label %next.5
next.5:
  store i64 1, ptr %stack.0
  br label %L8
L7:
  store i64 0, ptr %stack.0
  br label %L8
L8:
  %t.30 = load i64, ptr %stack.0
  ret i64 %t.30
}

define i32 @main() {
entry.0:
  %number.addr = alloca i64
  store i64 1, ptr %number.addr
  br label %L1
L1:
  %t.1 = load i64, ptr %number.addr
  %t.2 = icmp sge i64 %t.1, 10001
  br i1 %t.2, label %L2, label %next.1
next.1:
  %t.3 = load i64, ptr %number.addr
  %t.4 = call i64 @is_perfect(i64 %t.3)
  %t.5 = icmp eq i64 %t.4, 0
  br i1 %t.5, label %L3, label %next.2
next.2:
  %t.6 = load i64, ptr %number.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.6)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  br label %L4
L3:
  br label %L4
L4:
  %t.7 = load i64, ptr %number.addr
  %t.8 = add i64 %t.7, 1
  store i64 %t.8, ptr %number.addr
  br label %L1
L2:
  ret i32 0
}
