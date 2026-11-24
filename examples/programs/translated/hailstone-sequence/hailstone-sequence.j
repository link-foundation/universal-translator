; Hailstone sequence in JVM bytecode: count the steps to reach 1

.class public Program
.super java/lang/Object

.method public static hailstoneSteps(J)J
    .limit stack 7
    .limit locals 4
    .var 0 is number J
    .var 2 is steps J
    ldc2_w 0
    lstore 2
L1:
    lload 0
    ldc2_w 1
    lcmp
    ifeq L2
    lload 0
    ldc2_w 2
    lrem
    ldc2_w 0
    lcmp
    ifne L3
    lload 0
    ldc2_w 2
    ldiv
    lstore 0
    goto L4
L3:
    ldc2_w 3
    lload 0
    lmul
    ldc2_w 1
    ladd
    lstore 0
L4:
    lload 2
    ldc2_w 1
    ladd
    lstore 2
    goto L1
L2:
    lload 2
    lreturn
.end method

.method public static main([Ljava/lang/String;)V
    .limit stack 7
    .limit locals 3
    .var 1 is number J
    ldc2_w 1
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
    ldc " takes "
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    lload 1
    invokestatic Program/hailstoneSteps(J)J
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc " steps"
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
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
