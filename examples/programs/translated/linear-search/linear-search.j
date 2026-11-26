; Linear search in JVM bytecode: find the position of a value in a list

.class public Program
.super java/lang/Object

.method public static main([Ljava/lang/String;)V
    .limit stack 11
    .limit locals 13
    .var 1 is numbers [J
    .var 3 is wanted J
    .var 5 is position J
    .var 7 is current J
    .var 9 is index J
    .var 11 is number J
    ldc2_w 8
    ldc2_w 0
    invokestatic Program/newArray(JJ)[J
    dup
    ldc2_w 0
    l2i
    ldc2_w 31
    lastore
    dup
    ldc2_w 1
    l2i
    ldc2_w 41
    lastore
    dup
    ldc2_w 2
    l2i
    ldc2_w 59
    lastore
    dup
    ldc2_w 3
    l2i
    ldc2_w 26
    lastore
    dup
    ldc2_w 4
    l2i
    ldc2_w 53
    lastore
    dup
    ldc2_w 5
    l2i
    ldc2_w 58
    lastore
    dup
    ldc2_w 6
    l2i
    ldc2_w 97
    lastore
    dup
    ldc2_w 7
    l2i
    ldc2_w 93
    lastore
    astore 1
    ldc2_w 53
    lstore 3
    ldc2_w -1
    lstore 5
    ldc2_w 0
    lstore 7
    ldc2_w 0
    lstore 9
L1:
    lload 9
    aload 1
    arraylength
    i2l
    lcmp
    ifge L2
    aload 1
    lload 9
    l2i
    laload
    lstore 11
    lload 11
    lload 3
    lcmp
    ifne L3
    lload 5
    ldc2_w 0
    lcmp
    ifge L3
    lload 7
    lstore 5
    goto L4
L3:
L4:
    lload 7
    ldc2_w 1
    ladd
    lstore 7
    lload 9
    ldc2_w 1
    ladd
    lstore 9
    goto L1
L2:
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc "Found "
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    lload 3
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc " at position "
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    lload 5
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
    return
.end method

.method private static newArray(JJ)[J
    .limit stack 5
    .limit locals 4
    lload 0
    l2i
    newarray long
    dup
    lload 2
    invokestatic java/util/Arrays/fill([JJ)V
    areturn
.end method
