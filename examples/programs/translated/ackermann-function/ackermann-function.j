; Ackermann method in JVM bytecode, defined recursively

.class public Program
.super java/lang/Object

.method public static ackermann(JJ)J
    .limit stack 11
    .limit locals 4
    .var 0 is first J
    .var 2 is second J
    lload 0
    ldc2_w 0
    lcmp
    ifne L1
    lload 2
    ldc2_w 1
    ladd
    lreturn
    goto L2
L1:
L2:
    lload 2
    ldc2_w 0
    lcmp
    ifne L3
    lload 0
    ldc2_w 1
    lsub
    ldc2_w 1
    invokestatic Program/ackermann(JJ)J
    lreturn
    goto L4
L3:
L4:
    lload 0
    ldc2_w 1
    lsub
    lload 0
    lload 2
    ldc2_w 1
    lsub
    invokestatic Program/ackermann(JJ)J
    invokestatic Program/ackermann(JJ)J
    lreturn
.end method

.method public static main([Ljava/lang/String;)V
    .limit stack 7
    .limit locals 5
    .var 1 is first J
    .var 3 is second J
    ldc2_w 0
    lstore 1
L1:
    lload 1
    ldc2_w 4
    lcmp
    ifge L2
    ldc2_w 0
    lstore 3
L3:
    lload 3
    ldc2_w 5
    lcmp
    ifge L4
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc "ackermann("
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    lload 1
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc ", "
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    lload 3
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc ") = "
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    lload 1
    lload 3
    invokestatic Program/ackermann(JJ)J
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
    lload 3
    ldc2_w 1
    ladd
    lstore 3
    goto L3
L4:
    lload 1
    ldc2_w 1
    ladd
    lstore 1
    goto L1
L2:
    return
.end method
