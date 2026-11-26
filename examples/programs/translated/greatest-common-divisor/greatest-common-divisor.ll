; Greatest common divisor in LLVM IR, using the Euclidean algorithm

declare i32 @printf(ptr, ...)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"
@text.0 = private unnamed_addr constant [48 x i8] c"The greatest common divisor of 1071 and 462 is \00"

define i64 @greatest_common_divisor(i64 %first, i64 %second) {
entry.0:
  %first.addr = alloca i64
  %second.addr = alloca i64
  %remainder.addr = alloca i64
  store i64 %first, ptr %first.addr
  store i64 %second, ptr %second.addr
  br label %L1
L1:
  %t.1 = load i64, ptr %second.addr
  %t.2 = icmp eq i64 %t.1, 0
  br i1 %t.2, label %L2, label %next.1
next.1:
  %t.3 = load i64, ptr %first.addr
  %t.4 = load i64, ptr %second.addr
  %t.5 = srem i64 %t.3, %t.4
  store i64 %t.5, ptr %remainder.addr
  %t.6 = load i64, ptr %second.addr
  store i64 %t.6, ptr %first.addr
  %t.7 = load i64, ptr %remainder.addr
  store i64 %t.7, ptr %second.addr
  br label %L1
L2:
  %t.8 = load i64, ptr %first.addr
  ret i64 %t.8
}

define i32 @main() {
entry.0:
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.0)
  %t.1 = call i64 @greatest_common_divisor(i64 1071, i64 462)
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.1)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  ret i32 0
}
