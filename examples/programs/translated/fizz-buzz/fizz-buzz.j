; FizzBuzz in JVM bytecode

.class public Program
.super java/lang/Object

.method public static main([Ljava/lang/String;)V
    .limit stack 7
    .limit locals 3
    ldc2_w 1
    lstore 1
L1:
    lload 1
    ldc2_w 101
    lcmp
    ifge L2
    lload 1
    ldc2_w 15
    lrem
    ldc2_w 0
    lcmp
    ifne L3
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc "FizzBuzz"
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
    goto L4
L3:
    lload 1
    ldc2_w 3
    lrem
    ldc2_w 0
    lcmp
    ifne L5
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc "Fizz"
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
    goto L6
L5:
    lload 1
    ldc2_w 5
    lrem
    ldc2_w 0
    lcmp
    ifne L7
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc "Buzz"
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
    goto L8
L7:
    lload 1
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
L8:
L6:
L4:
    lload 1
    ldc2_w 1
    ladd
    lstore 1
    goto L1
L2:
    return
.end method
