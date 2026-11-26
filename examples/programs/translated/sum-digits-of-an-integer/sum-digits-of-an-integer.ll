; Sum digits of an integer in LLVM IR

declare i32 @printf(ptr, ...)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"
@text.0 = private unnamed_addr constant [33 x i8] c"The digits of 1234567890 sum to \00"

define i64 @sum_of_digits(i64 %number) {
entry.0:
  %number.addr = alloca i64
  %total.addr = alloca i64
  store i64 %number, ptr %number.addr
  store i64 0, ptr %total.addr
  br label %L1
L1:
  %t.1 = load i64, ptr %number.addr
  %t.2 = icmp sle i64 %t.1, 0
  br i1 %t.2, label %L2, label %next.1
next.1:
  %t.3 = load i64, ptr %total.addr
  %t.4 = load i64, ptr %number.addr
  %t.5 = srem i64 %t.4, 10
  %t.6 = add i64 %t.3, %t.5
  store i64 %t.6, ptr %total.addr
  %t.7 = load i64, ptr %number.addr
  %t.8 = sdiv i64 %t.7, 10
  store i64 %t.8, ptr %number.addr
  br label %L1
L2:
  %t.9 = load i64, ptr %total.addr
  ret i64 %t.9
}

define i32 @main() {
entry.0:
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.0)
  %t.1 = call i64 @sum_of_digits(i64 1234567890)
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.1)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  ret i32 0
}
