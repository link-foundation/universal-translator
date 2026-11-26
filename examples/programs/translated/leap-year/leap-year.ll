; Leap year in LLVM IR

declare i32 @printf(ptr, ...)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"
@text.0 = private unnamed_addr constant [16 x i8] c" is a leap year\00"
@text.1 = private unnamed_addr constant [20 x i8] c" is not a leap year\00"

define i64 @is_leap_year(i64 %year) {
entry.0:
  %year.addr = alloca i64
  %stack.0 = alloca i64
  store i64 %year, ptr %year.addr
  %t.1 = load i64, ptr %year.addr
  %t.2 = srem i64 %t.1, 4
  %t.3 = icmp ne i64 %t.2, 0
  br i1 %t.3, label %L4, label %next.1
next.1:
  %t.4 = load i64, ptr %year.addr
  %t.5 = srem i64 %t.4, 100
  %t.6 = icmp ne i64 %t.5, 0
  br i1 %t.6, label %L3, label %next.2
next.2:
  br label %L4
L4:
  %t.7 = load i64, ptr %year.addr
  %t.8 = srem i64 %t.7, 400
  %t.9 = icmp ne i64 %t.8, 0
  br i1 %t.9, label %L1, label %next.3
next.3:
  br label %L3
L3:
  store i64 1, ptr %stack.0
  br label %L2
L1:
  store i64 0, ptr %stack.0
  br label %L2
L2:
  %t.10 = load i64, ptr %stack.0
  ret i64 %t.10
}

define i32 @main() {
entry.0:
  %year.addr = alloca i64
  store i64 1896, ptr %year.addr
  br label %L1
L1:
  %t.1 = load i64, ptr %year.addr
  %t.2 = icmp sge i64 %t.1, 1913
  br i1 %t.2, label %L2, label %next.1
next.1:
  %t.3 = load i64, ptr %year.addr
  %t.4 = call i64 @is_leap_year(i64 %t.3)
  %t.5 = icmp eq i64 %t.4, 0
  br i1 %t.5, label %L3, label %next.2
next.2:
  %t.6 = load i64, ptr %year.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.6)
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.0)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  br label %L4
L3:
  %t.7 = load i64, ptr %year.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.7)
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.1)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  br label %L4
L4:
  %t.8 = load i64, ptr %year.addr
  %t.9 = add i64 %t.8, 1
  store i64 %t.9, ptr %year.addr
  br label %L1
L2:
  ret i32 0
}
