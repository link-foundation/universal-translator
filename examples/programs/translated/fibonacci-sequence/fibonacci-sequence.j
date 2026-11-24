; Fibonacci sequence in JVM bytecode, computed iteratively

.class public Program
.super java/lang/Object

.method public static fibonacci(J)J
    .limit stack 7
    .limit locals 10
    .var 0 is count J
    .var 2 is previous J
    .var 4 is current J
    .var 6 is step J
    .var 8 is next J
    ldc2_w 0
    lstore 2
    ldc2_w 1
    lstore 4
    ldc2_w 0
    lstore 6
L1:
    lload 6
    lload 0
    lcmp
    ifge L2
    lload 2
    lload 4
    ladd
    lstore 8
    lload 4
    lstore 2
    lload 8
    lstore 4
    lload 6
    ldc2_w 1
    ladd
    lstore 6
    goto L1
L2:
    lload 2
    lreturn
.end method

.method public static main([Ljava/lang/String;)V
    .limit stack 7
    .limit locals 3
    .var 1 is index J
    ldc2_w 0
    lstore 1
L1:
    lload 1
    ldc2_w 21
    lcmp
    ifge L2
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc "fibonacci("
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    lload 1
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc ") = "
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    lload 1
    invokestatic Program/fibonacci(J)J
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
    lload 1
    ldc2_w 1
    ladd
    lstore 1
    goto L1
L2:
    return
.end method
