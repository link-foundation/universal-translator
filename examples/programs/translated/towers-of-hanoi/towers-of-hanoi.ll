; Towers of Hanoi in LLVM IR, solved recursively

declare i32 @printf(ptr, ...)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"
@text.0 = private unnamed_addr constant [11 x i8] c"Move disk \00"
@text.1 = private unnamed_addr constant [7 x i8] c" from \00"
@text.2 = private unnamed_addr constant [5 x i8] c" to \00"

define void @move_disks(i64 %count, i64 %source, i64 %target, i64 %spare) {
entry.0:
  %count.addr = alloca i64
  %source.addr = alloca i64
  %target.addr = alloca i64
  %spare.addr = alloca i64
  store i64 %count, ptr %count.addr
  store i64 %source, ptr %source.addr
  store i64 %target, ptr %target.addr
  store i64 %spare, ptr %spare.addr
  %t.1 = load i64, ptr %count.addr
  %t.2 = icmp ne i64 %t.1, 0
  br i1 %t.2, label %L1, label %next.1
next.1:
  ret void
dead.2:
  br label %L2
L1:
  br label %L2
L2:
  %t.3 = load i64, ptr %count.addr
  %t.4 = sub i64 %t.3, 1
  %t.5 = load i64, ptr %source.addr
  %t.6 = load i64, ptr %spare.addr
  %t.7 = load i64, ptr %target.addr
  call void @move_disks(i64 %t.4, i64 %t.5, i64 %t.6, i64 %t.7)
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.0)
  %t.8 = load i64, ptr %count.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.8)
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.1)
  %t.9 = load i64, ptr %source.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.9)
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.2)
  %t.10 = load i64, ptr %target.addr
  call i32 (ptr, ...) @printf(ptr @integer_format, i64 %t.10)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  %t.11 = load i64, ptr %count.addr
  %t.12 = sub i64 %t.11, 1
  %t.13 = load i64, ptr %spare.addr
  %t.14 = load i64, ptr %target.addr
  %t.15 = load i64, ptr %source.addr
  call void @move_disks(i64 %t.12, i64 %t.13, i64 %t.14, i64 %t.15)
  ret void
}

define i32 @main() {
entry.0:
  call void @move_disks(i64 4, i64 1, i64 3, i64 2)
  ret i32 0
}
