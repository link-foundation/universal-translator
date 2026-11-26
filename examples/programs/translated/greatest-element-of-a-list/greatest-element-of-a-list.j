; Greatest element of a list in JVM bytecode

.class public Program
.super java/lang/Object

.method public static main([Ljava/lang/String;)V
    .limit stack 11
    .limit locals 9
    .var 1 is numbers [J
    .var 3 is greatest J
    .var 5 is index J
    .var 7 is number J
    ldc2_w 7
    ldc2_w 0
    invokestatic Program/newArray(JJ)[J
    dup
    ldc2_w 0
    l2i
    ldc2_w 17
    lastore
    dup
    ldc2_w 1
    l2i
    ldc2_w 4
    lastore
    dup
    ldc2_w 2
    l2i
    ldc2_w 93
    lastore
    dup
    ldc2_w 3
    l2i
    ldc2_w 28
    lastore
    dup
    ldc2_w 4
    l2i
    ldc2_w 65
    lastore
    dup
    ldc2_w 5
    l2i
    ldc2_w 3
    lastore
    dup
    ldc2_w 6
    l2i
    ldc2_w 80
    lastore
    astore 1
    aload 1
    ldc2_w 0
    l2i
    laload
    lstore 3
    ldc2_w 0
    lstore 5
L1:
    lload 5
    aload 1
    arraylength
    i2l
    lcmp
    ifge L2
    aload 1
    lload 5
    l2i
    laload
    lstore 7
    lload 7
    lload 3
    lcmp
    ifle L3
    lload 7
    lstore 3
    goto L4
L3:
L4:
    lload 5
    ldc2_w 1
    ladd
    lstore 5
    goto L1
L2:
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc "The greatest element is "
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    lload 3
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
