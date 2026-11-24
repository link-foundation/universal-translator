; Towers of Hanoi in JVM bytecode, solved recursively

.class public Program
.super java/lang/Object

.method public static moveDisks(JJJJ)V
    .limit stack 11
    .limit locals 8
    .var 0 is count J
    .var 2 is source J
    .var 4 is target J
    .var 6 is spare J
    lload 0
    ldc2_w 0
    lcmp
    ifne L1
    return
    goto L2
L1:
L2:
    lload 0
    ldc2_w 1
    lsub
    lload 2
    lload 6
    lload 4
    invokestatic Program/moveDisks(JJJJ)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc "Move disk "
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    lload 0
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc " from "
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    lload 2
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc " to "
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    lload 4
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
    lload 0
    ldc2_w 1
    lsub
    lload 6
    lload 4
    lload 2
    invokestatic Program/moveDisks(JJJJ)V
    return
.end method

.method public static main([Ljava/lang/String;)V
    .limit stack 11
    .limit locals 1
    ldc2_w 4
    ldc2_w 1
    ldc2_w 3
    ldc2_w 2
    invokestatic Program/moveDisks(JJJJ)V
    return
.end method
