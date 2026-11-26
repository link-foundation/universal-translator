; Sum and product of an array in LLVM IR

declare i32 @printf(ptr, ...)
declare ptr @malloc(i64)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"
@text.0 = private unnamed_addr constant [6 x i8] c"Sum: \00"
@text.1 = private unnamed_addr constant [10 x i8] c"Product: \00"

define i32 @main() {
entry.0:
  %numbers.addr = alloca ptr
  %total.addr = alloca i64
  %product.addr = alloca i64
  %index.addr = alloca i64
  %t.1 = call ptr @new_array(i64 5, i64 0)
  %t.2 = getelementptr i64, ptr %t.1, i64 0
  store i64 1, ptr %t.2
  %t.3 = getelementptr i64, ptr %t.1, i64 1
  store i64 2, ptr %t.3
  %t.4 = getelementptr i64, ptr %t.1, i64 2
  store i64 3, ptr %t.4
  %t.5 = getelementptr i64, ptr %t.1, i64 3
  store i64 4, ptr %t.5
  %t.6 = getelementptr i64, ptr %t.1, i64 4
  store i64 5, ptr %t.6
  store ptr %t.1, ptr %numbers.addr
  store i64 0, ptr %total.addr
  store i64 1, ptr %product.addr
  store i64 0, ptr %index.addr
  br label %L1
L1:
  %t.7 = load i64, ptr %index.addr
  %t.8 = load ptr, ptr %numbers.addr
  %t.9 = getelementptr i8, ptr %t.8, i64 -8
  %t.10 = load i64, ptr %t.9
  %t.11 = icmp sge i64 %t.7, %t.10
  br i1 %t.11, label %L2, label %next.1
next.1:
  %t.12 = load i64, ptr %total.addr
  %t.13 = load ptr, ptr %numbers.addr
  %t.14 = load i64, ptr %index.addr
  %t.15 = getelementptr i64, ptr %t.13, i64 %t.14
  %t.16 = load i64, ptr %t.15
  %t.17 = add i64 %t.12, %t.16
  store i64 %t.17, ptr %total.addr
  %t.18 = load i64, ptr %product.addr
  %t.19 = load ptr, ptr %numbers.addr
  %t.20 = load i64, ptr %index.addr
  %t.21 = getelementptr i64, ptr %t.19, i64 %t.20
  %t.22 = load i64, ptr %t.21
  %t.23 = mul i64 %t.18, %t.22
  store i64 %t.23, ptr %product.addr
  %t.24 = load i64, ptr %index.addr
  %t.25 = add i64 %t.24, 1
  store i64 %t.25, ptr %index.addr
  br label %L1
L2:
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.0)
  %t.26 = load i64, ptr %total.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.26)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.1)
  %t.27 = load i64, ptr %product.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.27)
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
