; Bubble sort in LLVM IR: sort a list of numbers

declare i32 @printf(ptr, ...)
declare ptr @malloc(i64)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"

define i32 @main() {
entry.0:
  %numbers.addr = alloca ptr
  %count.addr = alloca i64
  %pass.addr = alloca i64
  %index.addr = alloca i64
  %swap.addr = alloca i64
  %position.addr = alloca i64
  %t.1 = call ptr @new_array(i64 7, i64 0)
  %t.2 = getelementptr i64, ptr %t.1, i64 0
  store i64 5, ptr %t.2
  %t.3 = getelementptr i64, ptr %t.1, i64 1
  store i64 3, ptr %t.3
  %t.4 = getelementptr i64, ptr %t.1, i64 2
  store i64 8, ptr %t.4
  %t.5 = getelementptr i64, ptr %t.1, i64 3
  store i64 1, ptr %t.5
  %t.6 = getelementptr i64, ptr %t.1, i64 4
  store i64 9, ptr %t.6
  %t.7 = getelementptr i64, ptr %t.1, i64 5
  store i64 2, ptr %t.7
  %t.8 = getelementptr i64, ptr %t.1, i64 6
  store i64 7, ptr %t.8
  store ptr %t.1, ptr %numbers.addr
  %t.9 = load ptr, ptr %numbers.addr
  %t.10 = getelementptr i8, ptr %t.9, i64 -8
  %t.11 = load i64, ptr %t.10
  store i64 %t.11, ptr %count.addr
  store i64 0, ptr %pass.addr
  br label %L1
L1:
  %t.12 = load i64, ptr %pass.addr
  %t.13 = load i64, ptr %count.addr
  %t.14 = sub i64 %t.13, 1
  %t.15 = icmp sge i64 %t.12, %t.14
  br i1 %t.15, label %L2, label %next.1
next.1:
  store i64 0, ptr %index.addr
  br label %L3
L3:
  %t.16 = load i64, ptr %index.addr
  %t.17 = load i64, ptr %count.addr
  %t.18 = sub i64 %t.17, 1
  %t.19 = load i64, ptr %pass.addr
  %t.20 = sub i64 %t.18, %t.19
  %t.21 = icmp sge i64 %t.16, %t.20
  br i1 %t.21, label %L4, label %next.2
next.2:
  %t.22 = load ptr, ptr %numbers.addr
  %t.23 = load i64, ptr %index.addr
  %t.24 = getelementptr i64, ptr %t.22, i64 %t.23
  %t.25 = load i64, ptr %t.24
  %t.26 = load ptr, ptr %numbers.addr
  %t.27 = load i64, ptr %index.addr
  %t.28 = add i64 %t.27, 1
  %t.29 = getelementptr i64, ptr %t.26, i64 %t.28
  %t.30 = load i64, ptr %t.29
  %t.31 = icmp sle i64 %t.25, %t.30
  br i1 %t.31, label %L5, label %next.3
next.3:
  %t.32 = load ptr, ptr %numbers.addr
  %t.33 = load i64, ptr %index.addr
  %t.34 = getelementptr i64, ptr %t.32, i64 %t.33
  %t.35 = load i64, ptr %t.34
  store i64 %t.35, ptr %swap.addr
  %t.36 = load ptr, ptr %numbers.addr
  %t.37 = load i64, ptr %index.addr
  %t.38 = load ptr, ptr %numbers.addr
  %t.39 = load i64, ptr %index.addr
  %t.40 = add i64 %t.39, 1
  %t.41 = getelementptr i64, ptr %t.38, i64 %t.40
  %t.42 = load i64, ptr %t.41
  %t.43 = getelementptr i64, ptr %t.36, i64 %t.37
  store i64 %t.42, ptr %t.43
  %t.44 = load ptr, ptr %numbers.addr
  %t.45 = load i64, ptr %index.addr
  %t.46 = add i64 %t.45, 1
  %t.47 = load i64, ptr %swap.addr
  %t.48 = getelementptr i64, ptr %t.44, i64 %t.46
  store i64 %t.47, ptr %t.48
  br label %L6
L5:
  br label %L6
L6:
  %t.49 = load i64, ptr %index.addr
  %t.50 = add i64 %t.49, 1
  store i64 %t.50, ptr %index.addr
  br label %L3
L4:
  %t.51 = load i64, ptr %pass.addr
  %t.52 = add i64 %t.51, 1
  store i64 %t.52, ptr %pass.addr
  br label %L1
L2:
  store i64 0, ptr %position.addr
  br label %L7
L7:
  %t.53 = load i64, ptr %position.addr
  %t.54 = load i64, ptr %count.addr
  %t.55 = icmp sge i64 %t.53, %t.54
  br i1 %t.55, label %L8, label %next.4
next.4:
  %t.56 = load ptr, ptr %numbers.addr
  %t.57 = load i64, ptr %position.addr
  %t.58 = getelementptr i64, ptr %t.56, i64 %t.57
  %t.59 = load i64, ptr %t.58
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.59)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  %t.60 = load i64, ptr %position.addr
  %t.61 = add i64 %t.60, 1
  store i64 %t.61, ptr %position.addr
  br label %L7
L8:
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
