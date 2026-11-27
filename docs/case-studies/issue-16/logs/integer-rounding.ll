declare i32 @printf(ptr, ...)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"

define i64 @ut_integer_floor_divide(i64 %first, i64 %second) {
entry.0:
  %first.addr = alloca i64
  %second.addr = alloca i64
  %result.addr = alloca i64
  %residue.addr = alloca i64
  %stack.0 = alloca i64
  %stack.1 = alloca i64
  store i64 %first, ptr %first.addr
  store i64 %second, ptr %second.addr
  %t.1 = load i64, ptr %first.addr
  %t.2 = load i64, ptr %second.addr
  %t.3 = sdiv i64 %t.1, %t.2
  store i64 %t.3, ptr %result.addr
  %t.4 = load i64, ptr %first.addr
  %t.5 = load i64, ptr %result.addr
  %t.6 = load i64, ptr %second.addr
  %t.7 = mul i64 %t.5, %t.6
  %t.8 = sub i64 %t.4, %t.7
  store i64 %t.8, ptr %residue.addr
  %t.9 = load i64, ptr %residue.addr
  %t.10 = icmp eq i64 %t.9, 0
  br i1 %t.10, label %L1, label %next.1
next.1:
  %t.11 = load i64, ptr %first.addr
  %t.12 = icmp sge i64 %t.11, 0
  br i1 %t.12, label %L5, label %next.2
next.2:
  store i64 1, ptr %stack.0
  br label %L6
L5:
  store i64 0, ptr %stack.0
  br label %L6
L6:
  %t.13 = load i64, ptr %stack.0
  %t.14 = load i64, ptr %second.addr
  %t.15 = icmp sge i64 %t.14, 0
  br i1 %t.15, label %L7, label %next.3
next.3:
  %t.16 = load i64, ptr %stack.0
  store i64 1, ptr %stack.1
  br label %L8
L7:
  %t.17 = load i64, ptr %stack.0
  store i64 0, ptr %stack.1
  br label %L8
L8:
  %t.18 = load i64, ptr %stack.0
  %t.19 = load i64, ptr %stack.1
  %t.20 = icmp eq i64 %t.18, %t.19
  br i1 %t.20, label %L3, label %next.4
next.4:
  %t.21 = load i64, ptr %result.addr
  %t.22 = sub i64 %t.21, 1
  store i64 %t.22, ptr %result.addr
  br label %L4
L3:
  br label %L4
L4:
  br label %L2
L1:
  br label %L2
L2:
  %t.23 = load i64, ptr %result.addr
  %t.24 = icmp ne i64 %t.23, 0
  br i1 %t.24, label %L9, label %next.5
next.5:
  store i64 0, ptr %result.addr
  br label %L10
L9:
  br label %L10
L10:
  %t.25 = load i64, ptr %result.addr
  ret i64 %t.25
}

define i64 @ut_integer_modulo(i64 %first, i64 %second) {
entry.0:
  %first.addr = alloca i64
  %second.addr = alloca i64
  %result.addr = alloca i64
  store i64 %first, ptr %first.addr
  store i64 %second, ptr %second.addr
  %t.1 = load i64, ptr %first.addr
  %t.2 = load i64, ptr %second.addr
  %t.3 = call i64 @ut_integer_floor_divide(i64 %t.1, i64 %t.2)
  store i64 %t.3, ptr %result.addr
  %t.4 = load i64, ptr %first.addr
  %t.5 = load i64, ptr %result.addr
  %t.6 = load i64, ptr %second.addr
  %t.7 = mul i64 %t.5, %t.6
  %t.8 = sub i64 %t.4, %t.7
  ret i64 %t.8
}

define i32 @main() {
entry.0:
  %t.1 = call i64 @ut_integer_floor_divide(i64 -7, i64 3)
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.1)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  %t.2 = call i64 @ut_integer_modulo(i64 -7, i64 3)
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.2)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  ret i32 0
}
