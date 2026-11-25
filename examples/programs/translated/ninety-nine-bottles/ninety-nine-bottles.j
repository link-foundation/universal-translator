; 99 bottles of beer in JVM bytecode

.class public Program
.super java/lang/Object

.method public static main([Ljava/lang/String;)V
    .limit stack 7
    .limit locals 3
    .var 1 is bottles J
    ldc2_w 99
    lstore 1
L1:
    lload 1
    ldc2_w 0
    lcmp
    ifle L2
    lload 1
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc " bottles of beer on the wall, "
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    lload 1
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc " bottles of beer."
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc "Take one down and pass it around, "
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    lload 1
    ldc2_w 1
    lsub
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc " bottles of beer on the wall."
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
    lload 1
    ldc2_w 1
    lsub
    lstore 1
    goto L1
L2:
    return
.end method
