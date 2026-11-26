; FizzBuzz in LLVM IR

declare i32 @printf(ptr, ...)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"
@text.0 = private unnamed_addr constant [9 x i8] c"FizzBuzz\00"
@text.1 = private unnamed_addr constant [5 x i8] c"Fizz\00"
@text.2 = private unnamed_addr constant [5 x i8] c"Buzz\00"

define i32 @main() {
entry.0:
  %number.addr = alloca i64
  store i64 1, ptr %number.addr
  br label %L1
L1:
  %t.1 = load i64, ptr %number.addr
  %t.2 = icmp sge i64 %t.1, 101
  br i1 %t.2, label %L2, label %next.1
next.1:
  %t.3 = load i64, ptr %number.addr
  %t.4 = srem i64 %t.3, 15
  %t.5 = icmp ne i64 %t.4, 0
  br i1 %t.5, label %L3, label %next.2
next.2:
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.0)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  br label %L4
L3:
  %t.6 = load i64, ptr %number.addr
  %t.7 = srem i64 %t.6, 3
  %t.8 = icmp ne i64 %t.7, 0
  br i1 %t.8, label %L5, label %next.3
next.3:
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.1)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  br label %L6
L5:
  %t.9 = load i64, ptr %number.addr
  %t.10 = srem i64 %t.9, 5
  %t.11 = icmp ne i64 %t.10, 0
  br i1 %t.11, label %L7, label %next.4
next.4:
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.2)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  br label %L8
L7:
  %t.12 = load i64, ptr %number.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.12)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  br label %L8
L8:
  br label %L6
L6:
  br label %L4
L4:
  %t.13 = load i64, ptr %number.addr
  %t.14 = add i64 %t.13, 1
  store i64 %t.14, ptr %number.addr
  br label %L1
L2:
  ret i32 0
}
