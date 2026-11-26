; Hailstone sequence in LLVM IR: count the steps to reach 1

declare i32 @printf(ptr, ...)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"
@text.0 = private unnamed_addr constant [8 x i8] c" takes \00"
@text.1 = private unnamed_addr constant [7 x i8] c" steps\00"

define i64 @hailstone_steps(i64 %number) {
entry.0:
  %number.addr = alloca i64
  %steps.addr = alloca i64
  store i64 %number, ptr %number.addr
  store i64 0, ptr %steps.addr
  br label %L1
L1:
  %t.1 = load i64, ptr %number.addr
  %t.2 = icmp eq i64 %t.1, 1
  br i1 %t.2, label %L2, label %next.1
next.1:
  %t.3 = load i64, ptr %number.addr
  %t.4 = srem i64 %t.3, 2
  %t.5 = icmp ne i64 %t.4, 0
  br i1 %t.5, label %L3, label %next.2
next.2:
  %t.6 = load i64, ptr %number.addr
  %t.7 = sdiv i64 %t.6, 2
  store i64 %t.7, ptr %number.addr
  br label %L4
L3:
  %t.8 = load i64, ptr %number.addr
  %t.9 = mul i64 3, %t.8
  %t.10 = add i64 %t.9, 1
  store i64 %t.10, ptr %number.addr
  br label %L4
L4:
  %t.11 = load i64, ptr %steps.addr
  %t.12 = add i64 %t.11, 1
  store i64 %t.12, ptr %steps.addr
  br label %L1
L2:
  %t.13 = load i64, ptr %steps.addr
  ret i64 %t.13
}

define i32 @main() {
entry.0:
  %number.addr = alloca i64
  store i64 1, ptr %number.addr
  br label %L1
L1:
  %t.1 = load i64, ptr %number.addr
  %t.2 = icmp sge i64 %t.1, 11
  br i1 %t.2, label %L2, label %next.1
next.1:
  %t.3 = load i64, ptr %number.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.3)
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.0)
  %t.4 = load i64, ptr %number.addr
  %t.5 = call i64 @hailstone_steps(i64 %t.4)
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.5)
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.1)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  %t.6 = load i64, ptr %number.addr
  %t.7 = add i64 %t.6, 1
  store i64 %t.7, ptr %number.addr
  br label %L1
L2:
  ret i32 0
}
