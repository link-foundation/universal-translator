; Sum of squares in LLVM IR

declare i32 @printf(ptr, ...)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"
@text.0 = private unnamed_addr constant [26 x i8] c"Sum of squares from 1 to \00"
@text.1 = private unnamed_addr constant [2 x i8] c":\00"

define i64 @sum_of_squares(i64 %limit) {
entry.0:
  %limit.addr = alloca i64
  %total.addr = alloca i64
  %number.addr = alloca i64
  store i64 %limit, ptr %limit.addr
  store i64 0, ptr %total.addr
  store i64 1, ptr %number.addr
  br label %L1
L1:
  %t.1 = load i64, ptr %number.addr
  %t.2 = load i64, ptr %limit.addr
  %t.3 = icmp sgt i64 %t.1, %t.2
  br i1 %t.3, label %L2, label %next.1
next.1:
  %t.4 = load i64, ptr %total.addr
  %t.5 = load i64, ptr %number.addr
  %t.6 = load i64, ptr %number.addr
  %t.7 = mul i64 %t.5, %t.6
  %t.8 = add i64 %t.4, %t.7
  store i64 %t.8, ptr %total.addr
  %t.9 = load i64, ptr %number.addr
  %t.10 = add i64 %t.9, 1
  store i64 %t.10, ptr %number.addr
  br label %L1
L2:
  %t.11 = load i64, ptr %total.addr
  ret i64 %t.11
}

define i32 @main() {
entry.0:
  %limit.addr = alloca i64
  store i64 10, ptr %limit.addr
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.0)
  %t.1 = load i64, ptr %limit.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.1)
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.1)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  %t.2 = load i64, ptr %limit.addr
  %t.3 = call i64 @sum_of_squares(i64 %t.2)
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.3)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  ret i32 0
}
