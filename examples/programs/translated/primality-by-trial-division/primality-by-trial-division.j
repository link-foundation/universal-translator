; Primality by trial division in JVM bytecode

.class public Program
.super java/lang/Object

.method public static isPrime(J)J
    .limit stack 7
    .limit locals 4
    .var 0 is number J
    .var 2 is divisor J
    lload 0
    ldc2_w 2
    lcmp
    ifge L1
    ldc2_w 0
    lreturn
    goto L2
L1:
L2:
    ldc2_w 2
    lstore 2
L3:
    lload 2
    lload 2
    lmul
    lload 0
    lcmp
    ifgt L4
    lload 0
    lload 2
    lrem
    ldc2_w 0
    lcmp
    ifne L5
    ldc2_w 0
    lreturn
    goto L6
L5:
L6:
    lload 2
    ldc2_w 1
    ladd
    lstore 2
    goto L3
L4:
    ldc2_w 1
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
    ldc2_w 51
    lcmp
    ifge L2
    lload 1
    invokestatic Program/isPrime(J)J
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
