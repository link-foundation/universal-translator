; Fibonacci sequence in LLVM IR, computed iteratively

declare i32 @printf(ptr, ...)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"
@text.0 = private unnamed_addr constant [11 x i8] c"fibonacci(\00"
@text.1 = private unnamed_addr constant [5 x i8] c") = \00"

define i64 @fibonacci(i64 %count) {
entry.0:
  %count.addr = alloca i64
  %previous.addr = alloca i64
  %current.addr = alloca i64
  %step.addr = alloca i64
  %next.addr = alloca i64
  store i64 %count, ptr %count.addr
  store i64 0, ptr %previous.addr
  store i64 1, ptr %current.addr
  store i64 0, ptr %step.addr
  br label %L1
L1:
  %t.1 = load i64, ptr %step.addr
  %t.2 = load i64, ptr %count.addr
  %t.3 = icmp sge i64 %t.1, %t.2
  br i1 %t.3, label %L2, label %next.1
next.1:
  %t.4 = load i64, ptr %previous.addr
  %t.5 = load i64, ptr %current.addr
  %t.6 = add i64 %t.4, %t.5
  store i64 %t.6, ptr %next.addr
  %t.7 = load i64, ptr %current.addr
  store i64 %t.7, ptr %previous.addr
  %t.8 = load i64, ptr %next.addr
  store i64 %t.8, ptr %current.addr
  %t.9 = load i64, ptr %step.addr
  %t.10 = add i64 %t.9, 1
  store i64 %t.10, ptr %step.addr
  br label %L1
L2:
  %t.11 = load i64, ptr %previous.addr
  ret i64 %t.11
}

define i32 @main() {
entry.0:
  %index.addr = alloca i64
  store i64 0, ptr %index.addr
  br label %L1
L1:
  %t.1 = load i64, ptr %index.addr
  %t.2 = icmp sge i64 %t.1, 21
  br i1 %t.2, label %L2, label %next.1
next.1:
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.0)
  %t.3 = load i64, ptr %index.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.3)
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.1)
  %t.4 = load i64, ptr %index.addr
  %t.5 = call i64 @fibonacci(i64 %t.4)
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.5)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  %t.6 = load i64, ptr %index.addr
  %t.7 = add i64 %t.6, 1
  store i64 %t.7, ptr %index.addr
  br label %L1
L2:
  ret i32 0
}
