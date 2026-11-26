; Linear search in LLVM IR: find the position of a value in a list

declare i32 @printf(ptr, ...)
declare ptr @malloc(i64)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"
@text.0 = private unnamed_addr constant [7 x i8] c"Found \00"
@text.1 = private unnamed_addr constant [14 x i8] c" at position \00"

define i32 @main() {
entry.0:
  %numbers.addr = alloca ptr
  %wanted.addr = alloca i64
  %position.addr = alloca i64
  %current.addr = alloca i64
  %index.addr = alloca i64
  %number.addr = alloca i64
  %t.1 = call ptr @new_array(i64 8, i64 0)
  %t.2 = getelementptr i64, ptr %t.1, i64 0
  store i64 31, ptr %t.2
  %t.3 = getelementptr i64, ptr %t.1, i64 1
  store i64 41, ptr %t.3
  %t.4 = getelementptr i64, ptr %t.1, i64 2
  store i64 59, ptr %t.4
  %t.5 = getelementptr i64, ptr %t.1, i64 3
  store i64 26, ptr %t.5
  %t.6 = getelementptr i64, ptr %t.1, i64 4
  store i64 53, ptr %t.6
  %t.7 = getelementptr i64, ptr %t.1, i64 5
  store i64 58, ptr %t.7
  %t.8 = getelementptr i64, ptr %t.1, i64 6
  store i64 97, ptr %t.8
  %t.9 = getelementptr i64, ptr %t.1, i64 7
  store i64 93, ptr %t.9
  store ptr %t.1, ptr %numbers.addr
  store i64 53, ptr %wanted.addr
  store i64 -1, ptr %position.addr
  store i64 0, ptr %current.addr
  store i64 0, ptr %index.addr
  br label %L1
L1:
  %t.10 = load i64, ptr %index.addr
  %t.11 = load ptr, ptr %numbers.addr
  %t.12 = getelementptr i8, ptr %t.11, i64 -8
  %t.13 = load i64, ptr %t.12
  %t.14 = icmp sge i64 %t.10, %t.13
  br i1 %t.14, label %L2, label %next.1
next.1:
  %t.15 = load ptr, ptr %numbers.addr
  %t.16 = load i64, ptr %index.addr
  %t.17 = getelementptr i64, ptr %t.15, i64 %t.16
  %t.18 = load i64, ptr %t.17
  store i64 %t.18, ptr %number.addr
  %t.19 = load i64, ptr %number.addr
  %t.20 = load i64, ptr %wanted.addr
  %t.21 = icmp ne i64 %t.19, %t.20
  br i1 %t.21, label %L3, label %next.2
next.2:
  %t.22 = load i64, ptr %position.addr
  %t.23 = icmp sge i64 %t.22, 0
  br i1 %t.23, label %L3, label %next.3
next.3:
  %t.24 = load i64, ptr %current.addr
  store i64 %t.24, ptr %position.addr
  br label %L4
L3:
  br label %L4
L4:
  %t.25 = load i64, ptr %current.addr
  %t.26 = add i64 %t.25, 1
  store i64 %t.26, ptr %current.addr
  %t.27 = load i64, ptr %index.addr
  %t.28 = add i64 %t.27, 1
  store i64 %t.28, ptr %index.addr
  br label %L1
L2:
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.0)
  %t.29 = load i64, ptr %wanted.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.29)
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.1)
  %t.30 = load i64, ptr %position.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.30)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  ret i32 0
}

define private ptr @new_array(i64 %length, i64 %fill) {
entry.0:
  %bytes = shl i64 %length, 3
  %size = add i64 %bytes, 8
  %block = call ptr @malloc(i64 %size)
  store i64 %length, ptr %block
  %elements = getelementptr i64, ptr %block, i64 1
  br label %fill.test
fill.test:
  %index = phi i64 [ 0, %entry.0 ], [ %next, %fill.body ]
  %more = icmp slt i64 %index, %length
  br i1 %more, label %fill.body, label %fill.done
fill.body:
  %address = getelementptr i64, ptr %elements, i64 %index
  store i64 %fill, ptr %address
  %next = add i64 %index, 1
  br label %fill.test
fill.done:
  ret ptr %elements
}
