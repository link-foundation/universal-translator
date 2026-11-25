// Fibonacci sequence in CIL, computed iteratively

.assembly extern System.Runtime { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly extern System.Console { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly Program { }

.class public abstract sealed auto ansi Program
  extends [System.Runtime]System.Object
{
    .method public static int64 Fibonacci(int64 count) cil managed
    {
        .maxstack 2
        .locals init (int64 previous, int64 current, int64 step, int64 next)
        ldc.i8 0
        stloc 0
        ldc.i8 1
        stloc 1
        ldc.i8 0
        stloc 2
      L1:
        ldloc 2
        ldarg 0
        bge L2
        ldloc 0
        ldloc 1
        add
        stloc 3
        ldloc 1
        stloc 0
        ldloc 3
        stloc 1
        ldloc 2
        ldc.i8 1
        add
        stloc 2
        br L1
      L2:
        ldloc 0
        ret
    }

    .method public static void Main() cil managed
    {
        .entrypoint
        .maxstack 2
        .locals init (int64 index)
        ldc.i8 0
        stloc 0
      L1:
        ldloc 0
        ldc.i8 21
        bge L2
        ldstr "fibonacci("
        call void [System.Console]System.Console::Write(string)
        ldloc 0
        call void [System.Console]System.Console::Write(int64)
        ldstr ") = "
        call void [System.Console]System.Console::Write(string)
        ldloc 0
        call int64 Program::Fibonacci(int64)
        call void [System.Console]System.Console::Write(int64)
        call void [System.Console]System.Console::WriteLine()
        ldloc 0
        ldc.i8 1
        add
        stloc 0
        br L1
      L2:
        ret
    }
}
