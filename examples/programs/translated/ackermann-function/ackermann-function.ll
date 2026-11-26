; Ackermann function in LLVM IR, defined recursively

declare i32 @printf(ptr, ...)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"
@text.0 = private unnamed_addr constant [11 x i8] c"ackermann(\00"
@text.1 = private unnamed_addr constant [3 x i8] c", \00"
@text.2 = private unnamed_addr constant [5 x i8] c") = \00"

define i64 @ackermann(i64 %first, i64 %second) {
entry.0:
  %first.addr = alloca i64
  %second.addr = alloca i64
  store i64 %first, ptr %first.addr
  store i64 %second, ptr %second.addr
  %t.1 = load i64, ptr %first.addr
  %t.2 = icmp ne i64 %t.1, 0
  br i1 %t.2, label %L1, label %next.1
next.1:
  %t.3 = load i64, ptr %second.addr
  %t.4 = add i64 %t.3, 1
  ret i64 %t.4
dead.2:
  br label %L2
L1:
  br label %L2
L2:
  %t.5 = load i64, ptr %second.addr
  %t.6 = icmp ne i64 %t.5, 0
  br i1 %t.6, label %L3, label %next.3
next.3:
  %t.7 = load i64, ptr %first.addr
  %t.8 = sub i64 %t.7, 1
  %t.9 = call i64 @ackermann(i64 %t.8, i64 1)
  ret i64 %t.9
dead.4:
  br label %L4
L3:
  br label %L4
L4:
  %t.10 = load i64, ptr %first.addr
  %t.11 = sub i64 %t.10, 1
  %t.12 = load i64, ptr %first.addr
  %t.13 = load i64, ptr %second.addr
  %t.14 = sub i64 %t.13, 1
  %t.15 = call i64 @ackermann(i64 %t.12, i64 %t.14)
  %t.16 = call i64 @ackermann(i64 %t.11, i64 %t.15)
  ret i64 %t.16
}

define i32 @main() {
entry.0:
  %first.addr = alloca i64
  %second.addr = alloca i64
  store i64 0, ptr %first.addr
  br label %L1
L1:
  %t.1 = load i64, ptr %first.addr
  %t.2 = icmp sge i64 %t.1, 4
  br i1 %t.2, label %L2, label %next.1
next.1:
  store i64 0, ptr %second.addr
  br label %L3
L3:
  %t.3 = load i64, ptr %second.addr
  %t.4 = icmp sge i64 %t.3, 5
  br i1 %t.4, label %L4, label %next.2
next.2:
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.0)
  %t.5 = load i64, ptr %first.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.5)
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.1)
  %t.6 = load i64, ptr %second.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.6)
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.2)
  %t.7 = load i64, ptr %first.addr
  %t.8 = load i64, ptr %second.addr
  %t.9 = call i64 @ackermann(i64 %t.7, i64 %t.8)
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.9)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  %t.10 = load i64, ptr %second.addr
  %t.11 = add i64 %t.10, 1
  store i64 %t.11, ptr %second.addr
  br label %L3
L4:
  %t.12 = load i64, ptr %first.addr
  %t.13 = add i64 %t.12, 1
  store i64 %t.13, ptr %first.addr
  br label %L1
L2:
  ret i32 0
}
