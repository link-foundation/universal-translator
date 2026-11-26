; Factorial in LLVM IR, defined recursively

declare i32 @printf(ptr, ...)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"
@text.0 = private unnamed_addr constant [5 x i8] c"! = \00"

define i64 @factorial(i64 %number) {
entry.0:
  %number.addr = alloca i64
  store i64 %number, ptr %number.addr
  %t.1 = load i64, ptr %number.addr
  %t.2 = icmp sgt i64 %t.1, 1
  br i1 %t.2, label %L1, label %next.1
next.1:
  ret i64 1
dead.2:
  br label %L2
L1:
  br label %L2
L2:
  %t.3 = load i64, ptr %number.addr
  %t.4 = load i64, ptr %number.addr
  %t.5 = sub i64 %t.4, 1
  %t.6 = call i64 @factorial(i64 %t.5)
  %t.7 = mul i64 %t.3, %t.6
  ret i64 %t.7
}

define i32 @main() {
entry.0:
  %number.addr = alloca i64
  store i64 0, ptr %number.addr
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
  %t.5 = call i64 @factorial(i64 %t.4)
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.5)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  %t.6 = load i64, ptr %number.addr
  %t.7 = add i64 %t.6, 1
  store i64 %t.7, ptr %number.addr
  br label %L1
L2:
  ret i32 0
}
