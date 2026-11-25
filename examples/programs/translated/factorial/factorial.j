; Factorial in JVM bytecode, defined recursively

.class public Program
.super java/lang/Object

.method public static factorial(J)J
    .limit stack 9
    .limit locals 2
    .var 0 is number J
    lload 0
    ldc2_w 1
    lcmp
    ifgt L1
    ldc2_w 1
    lreturn
    goto L2
L1:
L2:
    lload 0
    lload 0
    ldc2_w 1
    lsub
    invokestatic Program/factorial(J)J
    lmul
    lreturn
.end method

.method public static main([Ljava/lang/String;)V
    .limit stack 7
    .limit locals 3
    .var 1 is number J
    ldc2_w 0
    lstore 1
L1:
    lload 1
    ldc2_w 11
    lcmp
    ifge L2
    lload 1
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc "! = "
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    lload 1
    invokestatic Program/factorial(J)J
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
