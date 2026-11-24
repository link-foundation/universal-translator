; Perfect numbers in JVM bytecode: numbers equal to the sum of their divisors

.class public Program
.super java/lang/Object

.method public static isPerfect(J)J
    .limit stack 9
    .limit locals 6
    .var 0 is number J
    .var 2 is sum J
    .var 4 is divisor J
    ldc2_w 1
    lstore 2
    ldc2_w 2
    lstore 4
L1:
    lload 4
    lload 4
    lmul
    lload 0
    lcmp
    ifgt L2
    lload 0
    lload 4
    lrem
    ldc2_w 0
    lcmp
    ifne L3
    lload 2
    lload 4
    ladd
    lstore 2
    lload 4
    lload 4
    lmul
    lload 0
    lcmp
    ifeq L5
    lload 2
    lload 0
    lload 4
    ldiv
    ladd
    lstore 2
    goto L6
L5:
L6:
    goto L4
L3:
L4:
    lload 4
    ldc2_w 1
    ladd
    lstore 4
    goto L1
L2:
    lload 0
    ldc2_w 1
    lcmp
    ifle L7
    lload 2
    lload 0
    lcmp
    ifne L7
    ldc2_w 1
    goto L8
L7:
    ldc2_w 0
L8:
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
    ldc2_w 10001
    lcmp
    ifge L2
    lload 1
    invokestatic Program/isPerfect(J)J
    ldc2_w 0
    lcmp
    ifeq L3
    lload 1
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
    goto L4
L3:
L4:
    lload 1
    ldc2_w 1
    ladd
    lstore 1
    goto L1
L2:
    return
.end method
