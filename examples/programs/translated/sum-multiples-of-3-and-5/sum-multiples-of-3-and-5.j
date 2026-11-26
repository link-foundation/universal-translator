; Sum multiples of 3 and 5 in JVM bytecode: the sum of the multiples below 1000

.class public Program
.super java/lang/Object

.method public static main([Ljava/lang/String;)V
    .limit stack 7
    .limit locals 5
    .var 1 is total J
    .var 3 is number J
    ldc2_w 0
    lstore 1
    ldc2_w 1
    lstore 3
L1:
    lload 3
    ldc2_w 1000
    lcmp
    ifge L2
    lload 3
    ldc2_w 3
    lrem
    ldc2_w 0
    lcmp
    ifeq L5
    lload 3
    ldc2_w 5
    lrem
    ldc2_w 0
    lcmp
    ifne L3
L5:
    lload 1
    lload 3
    ladd
    lstore 1
    goto L4
L3:
L4:
    lload 3
    ldc2_w 1
    ladd
    lstore 3
    goto L1
L2:
    lload 1
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
    return
.end method
