; Primality by trial division in LLVM IR

declare i32 @printf(ptr, ...)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"

define i64 @is_prime(i64 %number) {
entry.0:
  %number.addr = alloca i64
  %divisor.addr = alloca i64
  store i64 %number, ptr %number.addr
  %t.1 = load i64, ptr %number.addr
  %t.2 = icmp sge i64 %t.1, 2
  br i1 %t.2, label %L1, label %next.1
next.1:
  ret i64 0
dead.2:
  br label %L2
L1:
  br label %L2
L2:
  store i64 2, ptr %divisor.addr
  br label %L3
L3:
  %t.3 = load i64, ptr %divisor.addr
  %t.4 = load i64, ptr %divisor.addr
  %t.5 = mul i64 %t.3, %t.4
  %t.6 = load i64, ptr %number.addr
  %t.7 = icmp sgt i64 %t.5, %t.6
  br i1 %t.7, label %L4, label %next.3
next.3:
  %t.8 = load i64, ptr %number.addr
  %t.9 = load i64, ptr %divisor.addr
  %t.10 = srem i64 %t.8, %t.9
  %t.11 = icmp ne i64 %t.10, 0
  br i1 %t.11, label %L5, label %next.4
next.4:
  ret i64 0
dead.5:
  br label %L6
L5:
  br label %L6
L6:
  %t.12 = load i64, ptr %divisor.addr
  %t.13 = add i64 %t.12, 1
  store i64 %t.13, ptr %divisor.addr
  br label %L3
L4:
  ret i64 1
}

define i32 @main() {
entry.0:
  %number.addr = alloca i64
  store i64 1, ptr %number.addr
  br label %L1
L1:
  %t.1 = load i64, ptr %number.addr
  %t.2 = icmp sge i64 %t.1, 51
  br i1 %t.2, label %L2, label %next.1
next.1:
  %t.3 = load i64, ptr %number.addr
  %t.4 = call i64 @is_prime(i64 %t.3)
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
