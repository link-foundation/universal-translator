// Mutual recursion in CIL: the Hofstadter Female and Male sequences

.assembly extern System.Runtime { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly extern System.Console { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly Program { }

.class public abstract sealed auto ansi Program
  extends [System.Runtime]System.Object
{
    .method public static int64 Female(int64 index) cil managed
    {
        .maxstack 3
        ldarg 0
        ldc.i8 0
        bne.un L1
        ldc.i8 1
        ret
        br L2
      L1:
      L2:
        ldarg 0
        ldarg 0
        ldc.i8 1
        sub
        call int64 Program::Female(int64)
        call int64 Program::Male(int64)
        sub
        ret
    }

    .method public static int64 Male(int64 index) cil managed
    {
        .maxstack 3
        ldarg 0
        ldc.i8 0
        bne.un L1
        ldc.i8 0
        ret
        br L2
      L1:
      L2:
        ldarg 0
        ldarg 0
        ldc.i8 1
        sub
        call int64 Program::Male(int64)
        call int64 Program::Female(int64)
        sub
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
        ldc.i8 20
        bge L2
        ldloc 0
        call void [System.Console]System.Console::Write(int64)
        ldstr ": "
        call void [System.Console]System.Console::Write(string)
        ldloc 0
        call int64 Program::Female(int64)
        call void [System.Console]System.Console::Write(int64)
        ldstr " "
        call void [System.Console]System.Console::Write(string)
        ldloc 0
        call int64 Program::Male(int64)
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
