; Sum and product of an array in JVM bytecode

.class public Program
.super java/lang/Object

.method public static main([Ljava/lang/String;)V
    .limit stack 11
    .limit locals 9
    .var 1 is numbers [J
    .var 3 is total J
    .var 5 is product J
    .var 7 is index J
    ldc2_w 5
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
    ldc2_w 2
    lastore
    dup
    ldc2_w 2
    l2i
    ldc2_w 3
    lastore
    dup
    ldc2_w 3
    l2i
    ldc2_w 4
    lastore
    dup
    ldc2_w 4
    l2i
    ldc2_w 5
    lastore
    astore 1
    ldc2_w 0
    lstore 3
    ldc2_w 1
    lstore 5
    ldc2_w 0
    lstore 7
L1:
    lload 7
    aload 1
    arraylength
    i2l
    lcmp
    ifge L2
    lload 3
    aload 1
    lload 7
    l2i
    laload
    ladd
    lstore 3
    lload 5
    aload 1
    lload 7
    l2i
    laload
    lmul
    lstore 5
    lload 7
    ldc2_w 1
    ladd
    lstore 7
    goto L1
L2:
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc "Sum: "
    invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V
    lload 3
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc "Product: "
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
