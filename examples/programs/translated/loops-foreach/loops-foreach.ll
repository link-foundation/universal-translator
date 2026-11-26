; Loops/Foreach in LLVM IR: print every element of a collection

declare i32 @printf(ptr, ...)
declare ptr @malloc(i64)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"

define i32 @main() {
entry.0:
  %numbers.addr = alloca ptr
  %index.addr = alloca i64
  %number.addr = alloca i64
  %t.1 = call ptr @new_array(i64 8, i64 0)
  %t.2 = getelementptr i64, ptr %t.1, i64 0
  store i64 1, ptr %t.2
  %t.3 = getelementptr i64, ptr %t.1, i64 1
  store i64 1, ptr %t.3
  %t.4 = getelementptr i64, ptr %t.1, i64 2
  store i64 2, ptr %t.4
  %t.5 = getelementptr i64, ptr %t.1, i64 3
  store i64 3, ptr %t.5
  %t.6 = getelementptr i64, ptr %t.1, i64 4
  store i64 5, ptr %t.6
  %t.7 = getelementptr i64, ptr %t.1, i64 5
  store i64 8, ptr %t.7
  %t.8 = getelementptr i64, ptr %t.1, i64 6
  store i64 13, ptr %t.8
  %t.9 = getelementptr i64, ptr %t.1, i64 7
  store i64 21, ptr %t.9
  store ptr %t.1, ptr %numbers.addr
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
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.19)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  %t.20 = load i64, ptr %index.addr
  %t.21 = add i64 %t.20, 1
  store i64 %t.21, ptr %index.addr
  br label %L1
L2:
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
