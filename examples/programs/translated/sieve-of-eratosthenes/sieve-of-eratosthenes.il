// Sieve of Eratosthenes in CIL: the primes up to 100

.assembly extern System.Runtime { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly extern System.Console { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly Program { }

.class public abstract sealed auto ansi Program
  extends [System.Runtime]System.Object
{
    .method public static void Main() cil managed
    {
        .entrypoint
        .maxstack 3
        .locals init (int64 limit, int64[] isPrime, int64 number, int64 multiple)
        ldc.i8 100
        stloc 0
        ldloc 0
        ldc.i8 1
        add
        ldc.i8 1
        call int64[] Program::NewArray(int64, int64)
        stloc 1
        ldloc 1
        ldc.i8 0
        conv.ovf.i
        ldc.i8 0
        stelem.i8
        ldloc 1
        ldc.i8 1
        conv.ovf.i
        ldc.i8 0
        stelem.i8
        ldc.i8 2
        stloc 2
      L1:
        ldloc 2
        ldloc 0
        ldc.i8 1
        add
        bge L2
        ldloc 1
        ldloc 2
        conv.ovf.i
        ldelem.i8
        ldc.i8 1
        bne.un L3
        ldloc 2
        call void [System.Console]System.Console::Write(int64)
        call void [System.Console]System.Console::WriteLine()
        ldloc 2
        ldloc 2
        mul
        stloc 3
      L5:
        ldloc 3
        ldloc 0
        bgt L6
        ldloc 1
        ldloc 3
        conv.ovf.i
        ldc.i8 0
        stelem.i8
        ldloc 3
        ldloc 2
        add
        stloc 3
        br L5
      L6:
        br L4
      L3:
      L4:
        ldloc 2
        ldc.i8 1
        add
        stloc 2
        br L1
      L2:
        ret
    }

    .method private static int64[] NewArray(int64 length, int64 fill) cil managed
    {
        .maxstack 3
        ldarg 0
        conv.ovf.i
        newarr [System.Runtime]System.Int64
        dup
        ldarg 1
        call void [System.Runtime]System.Array::Fill<int64>(!!0[], !!0)
        ret
    }
}
