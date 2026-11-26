; Sum multiples of 3 and 5 in LLVM IR: the sum of the multiples below 1000

declare i32 @printf(ptr, ...)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"

define i32 @main() {
entry.0:
  %total.addr = alloca i64
  %number.addr = alloca i64
  store i64 0, ptr %total.addr
  store i64 1, ptr %number.addr
  br label %L1
L1:
  %t.1 = load i64, ptr %number.addr
  %t.2 = icmp sge i64 %t.1, 1000
  br i1 %t.2, label %L2, label %next.1
next.1:
  %t.3 = load i64, ptr %number.addr
  %t.4 = srem i64 %t.3, 3
  %t.5 = icmp eq i64 %t.4, 0
  br i1 %t.5, label %L5, label %next.2
next.2:
  %t.6 = load i64, ptr %number.addr
  %t.7 = srem i64 %t.6, 5
  %t.8 = icmp ne i64 %t.7, 0
  br i1 %t.8, label %L3, label %next.3
next.3:
  br label %L5
L5:
  %t.9 = load i64, ptr %total.addr
  %t.10 = load i64, ptr %number.addr
  %t.11 = add i64 %t.9, %t.10
  store i64 %t.11, ptr %total.addr
  br label %L4
L3:
  br label %L4
L4:
  %t.12 = load i64, ptr %number.addr
  %t.13 = add i64 %t.12, 1
  store i64 %t.13, ptr %number.addr
  br label %L1
L2:
  %t.14 = load i64, ptr %total.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.14)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  ret i32 0
}
