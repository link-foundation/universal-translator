; Greatest common divisor in JVM bytecode, using the Euclidean algorithm

.class public Program
.super java/lang/Object

.method public static greatestCommonDivisor(JJ)J
    .limit stack 7
    .limit locals 6
    .var 0 is first J
    .var 2 is second J
    .var 4 is remainder J
L1:
    lload 2
    ldc2_w 0
    lcmp
    ifeq L2
    lload 0
    lload 2
    lrem
    lstore 4
    lload 2
    lstore 0
    lload 4
    lstore 2
    goto L1
L2:
    lload 0
    lreturn
.end method

.method public static main([Ljava/lang/String;)V
    .limit stack 7
    .limit locals 1
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc "The greatest common divisor of 1071 and 462 is "
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    ldc2_w 1071
    ldc2_w 462
    invokestatic Program/greatestCommonDivisor(JJ)J
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
    return
.end method
