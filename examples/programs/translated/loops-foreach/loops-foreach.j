; Loops/Foreach in JVM bytecode: print every element of a collection

.class public Program
.super java/lang/Object

.method public static main([Ljava/lang/String;)V
    .limit stack 11
    .limit locals 7
    .var 1 is numbers [J
    .var 3 is index J
    .var 5 is number J
    ldc2_w 8
    ldc2_w 0
    invokestatic Program/newArray(JJ)[J
    dup
    ldc2_w 0
    l2i
    ldc2_w 1
    lastore
    dup
    ldc2_w 1
    l2i
    ldc2_w 1
    lastore
    dup
    ldc2_w 2
    l2i
    ldc2_w 2
    lastore
    dup
    ldc2_w 3
    l2i
    ldc2_w 3
    lastore
    dup
    ldc2_w 4
    l2i
    ldc2_w 5
    lastore
    dup
    ldc2_w 5
    l2i
    ldc2_w 8
    lastore
    dup
    ldc2_w 6
    l2i
    ldc2_w 13
    lastore
    dup
    ldc2_w 7
    l2i
    ldc2_w 21
    lastore
    astore 1
    ldc2_w 0
    lstore 3
L1:
    lload 3
    aload 1
    arraylength
    i2l
    lcmp
    ifge L2
    aload 1
    lload 3
    l2i
    laload
    lstore 5
    lload 5
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
    goto L1
L2:
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
