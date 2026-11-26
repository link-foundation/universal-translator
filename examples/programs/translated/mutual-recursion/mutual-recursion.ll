; Mutual recursion in LLVM IR: the Hofstadter Female and Male sequences

declare i32 @printf(ptr, ...)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"
@text.0 = private unnamed_addr constant [3 x i8] c": \00"
@text.1 = private unnamed_addr constant [2 x i8] c" \00"

define i64 @female(i64 %index) {
entry.0:
  %index.addr = alloca i64
  store i64 %index, ptr %index.addr
  %t.1 = load i64, ptr %index.addr
  %t.2 = icmp ne i64 %t.1, 0
  br i1 %t.2, label %L1, label %next.1
next.1:
  ret i64 1
dead.2:
  br label %L2
L1:
  br label %L2
L2:
  %t.3 = load i64, ptr %index.addr
  %t.4 = load i64, ptr %index.addr
  %t.5 = sub i64 %t.4, 1
  %t.6 = call i64 @female(i64 %t.5)
  %t.7 = call i64 @male(i64 %t.6)
  %t.8 = sub i64 %t.3, %t.7
  ret i64 %t.8
}

define i64 @male(i64 %index) {
entry.0:
  %index.addr = alloca i64
  store i64 %index, ptr %index.addr
  %t.1 = load i64, ptr %index.addr
  %t.2 = icmp ne i64 %t.1, 0
  br i1 %t.2, label %L1, label %next.1
next.1:
  ret i64 0
dead.2:
  br label %L2
L1:
  br label %L2
L2:
  %t.3 = load i64, ptr %index.addr
  %t.4 = load i64, ptr %index.addr
  %t.5 = sub i64 %t.4, 1
  %t.6 = call i64 @male(i64 %t.5)
  %t.7 = call i64 @female(i64 %t.6)
  %t.8 = sub i64 %t.3, %t.7
  ret i64 %t.8
}

define i32 @main() {
entry.0:
  %index.addr = alloca i64
  store i64 0, ptr %index.addr
  br label %L1
L1:
  %t.1 = load i64, ptr %index.addr
  %t.2 = icmp sge i64 %t.1, 20
  br i1 %t.2, label %L2, label %next.1
next.1:
  %t.3 = load i64, ptr %index.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.3)
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.0)
  %t.4 = load i64, ptr %index.addr
  %t.5 = call i64 @female(i64 %t.4)
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.5)
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.1)
  %t.6 = load i64, ptr %index.addr
  %t.7 = call i64 @male(i64 %t.6)
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.7)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  %t.8 = load i64, ptr %index.addr
  %t.9 = add i64 %t.8, 1
  store i64 %t.9, ptr %index.addr
  br label %L1
L2:
  ret i32 0
}
