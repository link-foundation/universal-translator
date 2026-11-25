; Leap year in JVM bytecode

.class public Program
.super java/lang/Object

.method public static isLeapYear(J)J
    .limit stack 7
    .limit locals 2
    .var 0 is year J
    lload 0
    ldc2_w 4
    lrem
    ldc2_w 0
    lcmp
    ifne L4
    lload 0
    ldc2_w 100
    lrem
    ldc2_w 0
    lcmp
    ifne L3
L4:
    lload 0
    ldc2_w 400
    lrem
    ldc2_w 0
    lcmp
    ifne L1
L3:
    ldc2_w 1
    goto L2
L1:
    ldc2_w 0
L2:
    lreturn
.end method

.method public static main([Ljava/lang/String;)V
    .limit stack 7
    .limit locals 3
    .var 1 is year J
    ldc2_w 1896
    lstore 1
L1:
    lload 1
    ldc2_w 1913
    lcmp
    ifge L2
    lload 1
    invokestatic Program/isLeapYear(J)J
    ldc2_w 0
    lcmp
    ifeq L3
    lload 1
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc " is a leap year"
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
    goto L4
L3:
    lload 1
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc " is not a leap year"
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
L4:
    lload 1
    ldc2_w 1
    ladd
    lstore 1
    goto L1
L2:
    return
.end method
