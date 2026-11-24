; Sum of squares in JVM bytecode

.class public Program
.super java/lang/Object

.method public static sumOfSquares(J)J
    .limit stack 9
    .limit locals 6
    .var 0 is limit J
    .var 2 is total J
    .var 4 is number J
    ldc2_w 0
    lstore 2
    ldc2_w 1
    lstore 4
L1:
    lload 4
    lload 0
    lcmp
    ifgt L2
    lload 2
    lload 4
    lload 4
    lmul
    ladd
    lstore 2
    lload 4
    ldc2_w 1
    ladd
    lstore 4
    goto L1
L2:
    lload 2
    lreturn
.end method

.method public static main([Ljava/lang/String;)V
    .limit stack 5
    .limit locals 3
    .var 1 is limit J
    ldc2_w 10
    lstore 1
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc "Sum of squares from 1 to "
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    lload 1
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc ":"
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
    lload 1
    invokestatic Program/sumOfSquares(J)J
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
    return
.end method
