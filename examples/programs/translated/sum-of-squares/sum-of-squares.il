// Sum of squares in CIL

.assembly extern System.Runtime { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly extern System.Console { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly Program { }

.class public abstract sealed auto ansi Program
  extends [System.Runtime]System.Object
{
    .method public static int64 SumOfSquares(int64) cil managed
    {
        .maxstack 3
        .locals init (int64, int64)
        ldc.i8 0
        stloc 0
        ldc.i8 1
        stloc 1
      L1:
        ldloc 1
        ldarg 0
        bgt L2
        ldloc 0
        ldloc 1
        ldloc 1
        mul
        add
        stloc 0
        ldloc 1
        ldc.i8 1
        add
        stloc 1
        br L1
      L2:
        ldloc 0
        ret
    }

    .method public static void Main() cil managed
    {
        .entrypoint
        .maxstack 1
        .locals init (int64)
        ldc.i8 10
        stloc 0
        ldstr "Sum of squares from 1 to "
        call void [System.Console]System.Console::Write(string)
        ldloc 0
        call void [System.Console]System.Console::Write(int64)
        ldstr ":"
        call void [System.Console]System.Console::Write(string)
        call void [System.Console]System.Console::WriteLine()
        ldloc 0
        call int64 Program::SumOfSquares(int64)
        call void [System.Console]System.Console::Write(int64)
        call void [System.Console]System.Console::WriteLine()
        ret
    }
}
