; Bubble sort in JVM bytecode: sort a list of numbers

.class public Program
.super java/lang/Object

.method public static main([Ljava/lang/String;)V
    .limit stack 13
    .limit locals 13
    .var 1 is numbers [J
    .var 3 is count J
    .var 5 is pass J
    .var 7 is index J
    .var 9 is swap_ J
    .var 11 is position J
    ldc2_w 7
    ldc2_w 0
    invokestatic Program/newArray(JJ)[J
    dup
    ldc2_w 0
    l2i
    ldc2_w 5
    lastore
    dup
    ldc2_w 1
    l2i
    ldc2_w 3
    lastore
    dup
    ldc2_w 2
    l2i
    ldc2_w 8
    lastore
    dup
    ldc2_w 3
    l2i
    ldc2_w 1
    lastore
    dup
    ldc2_w 4
    l2i
    ldc2_w 9
    lastore
    dup
    ldc2_w 5
    l2i
    ldc2_w 2
    lastore
    dup
    ldc2_w 6
    l2i
    ldc2_w 7
    lastore
    astore 1
    aload 1
    arraylength
    i2l
    lstore 3
    ldc2_w 0
    lstore 5
L1:
    lload 5
    lload 3
    ldc2_w 1
    lsub
    lcmp
    ifge L2
    ldc2_w 0
    lstore 7
L3:
    lload 7
    lload 3
    ldc2_w 1
    lsub
    lload 5
    lsub
    lcmp
    ifge L4
    aload 1
    lload 7
    l2i
    laload
    aload 1
    lload 7
    ldc2_w 1
    ladd
    l2i
    laload
    lcmp
    ifle L5
    aload 1
    lload 7
    l2i
    laload
    lstore 9
    aload 1
    lload 7
    l2i
    aload 1
    lload 7
    ldc2_w 1
    ladd
    l2i
    laload
    lastore
    aload 1
    lload 7
    ldc2_w 1
    ladd
    l2i
    lload 9
    lastore
    goto L6
L5:
L6:
    lload 7
    ldc2_w 1
    ladd
    lstore 7
    goto L3
L4:
    lload 5
    ldc2_w 1
    ladd
    lstore 5
    goto L1
L2:
    ldc2_w 0
    lstore 11
L7:
    lload 11
    lload 3
    lcmp
    ifge L8
    aload 1
    lload 11
    l2i
    laload
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
    lload 11
    ldc2_w 1
    ladd
    lstore 11
    goto L7
L8:
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
