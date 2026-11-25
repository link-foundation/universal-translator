; Sieve of Eratosthenes in JVM bytecode: the primes up to 100

.class public Program
.super java/lang/Object

.method public static main([Ljava/lang/String;)V
    .limit stack 9
    .limit locals 9
    .var 1 is limit J
    .var 3 is isPrime [J
    .var 5 is number J
    .var 7 is multiple J
    ldc2_w 100
    lstore 1
    lload 1
    ldc2_w 1
    ladd
    ldc2_w 1
    invokestatic Program/newArray(JJ)[J
    astore 3
    aload 3
    ldc2_w 0
    l2i
    ldc2_w 0
    lastore
    aload 3
    ldc2_w 1
    l2i
    ldc2_w 0
    lastore
    ldc2_w 2
    lstore 5
L1:
    lload 5
    lload 1
    ldc2_w 1
    ladd
    lcmp
    ifge L2
    aload 3
    lload 5
    l2i
    laload
    ldc2_w 1
    lcmp
    ifne L3
    lload 5
    getstatic java/lang/System/out Ljava/io/PrintStream;
    dup_x2
    pop
    invokevirtual java/io/PrintStream/print(J)V
    getstatic java/lang/System/out Ljava/io/PrintStream;
    invokevirtual java/io/PrintStream/println()V
    lload 5
    lload 5
    lmul
    lstore 7
L5:
    lload 7
    lload 1
    lcmp
    ifgt L6
    aload 3
    lload 7
    l2i
    ldc2_w 0
    lastore
    lload 7
    lload 5
    ladd
    lstore 7
    goto L5
L6:
    goto L4
L3:
L4:
    lload 5
    ldc2_w 1
    ladd
    lstore 5
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
