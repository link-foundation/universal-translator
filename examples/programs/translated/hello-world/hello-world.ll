; Hello World in LLVM IR

declare i32 @printf(ptr, ...)

@integer_format = private unnamed_addr constant [5 x i8] c"%lld\00"
@text_format = private unnamed_addr constant [3 x i8] c"%s\00"
@newline_format = private unnamed_addr constant [2 x i8] c"\0A\00"
@text.0 = private unnamed_addr constant [13 x i8] c"Hello World!\00"

define i32 @main() {
entry.0:
  ; print "Hello World!" into console followed by new line symbol by call instruction
  call i32 (ptr, ...) @printf(ptr @text_format, ptr @text.0)
  call i32 (ptr, ...) @printf(ptr @newline_format)
  ret i32 0
}
