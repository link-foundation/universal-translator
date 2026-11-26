; 99 bottles of beer in LLVM IR

declare i32 @printf(ptr, ...)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"
@text.0 = private unnamed_addr constant [31 x i8] c" bottles of beer on the wall, \00"
@text.1 = private unnamed_addr constant [18 x i8] c" bottles of beer.\00"
@text.2 = private unnamed_addr constant [35 x i8] c"Take one down and pass it around, \00"
@text.3 = private unnamed_addr constant [30 x i8] c" bottles of beer on the wall.\00"

define i32 @main() {
entry.0:
  %bottles.addr = alloca i64
  store i64 99, ptr %bottles.addr
  br label %L1
L1:
  %t.1 = load i64, ptr %bottles.addr
  %t.2 = icmp sle i64 %t.1, 0
  br i1 %t.2, label %L2, label %next.1
next.1:
  %t.3 = load i64, ptr %bottles.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.3)
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.0)
  %t.4 = load i64, ptr %bottles.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.4)
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.1)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.2)
  %t.5 = load i64, ptr %bottles.addr
  %t.6 = sub i64 %t.5, 1
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.6)
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.3)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  %t.7 = load i64, ptr %bottles.addr
  %t.8 = sub i64 %t.7, 1
  store i64 %t.8, ptr %bottles.addr
  br label %L1
L2:
  ret i32 0
}
