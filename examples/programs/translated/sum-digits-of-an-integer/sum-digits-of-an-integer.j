; Sum digits of an integer in JVM bytecode

.class public Program
.super java/lang/Object

.method public static sumOfDigits(J)J
    .limit stack 9
    .limit locals 4
    .var 0 is number J
    .var 2 is total J
    ldc2_w 0
    lstore 2
L1:
    lload 0
    ldc2_w 0
    lcmp
    ifle L2
    lload 2
    lload 0
    ldc2_w 10
    lrem
    ladd
    lstore 2
    lload 0
    ldc2_w 10
    ldiv
    lstore 0
    goto L1
L2:
    lload 2
    lreturn
.end method

.method public static main([Ljava/lang/String;)V
    .limit stack 5
    .limit locals 1
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc "The digits of 1234567890 sum to "
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    ldc2_w 1234567890
    invokestatic Program/sumOfDigits(J)J
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
    return
.end method
