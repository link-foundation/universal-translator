// Hailstone sequence in CIL: count the steps to reach 1

.assembly extern System.Runtime { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly extern System.Console { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly Program { }

.class public abstract sealed auto ansi Program
  extends [System.Runtime]System.Object
{
    .method public static int64 HailstoneSteps(int64 number) cil managed
    {
        .maxstack 2
        .locals init (int64 steps)
        ldc.i8 0
        stloc 0
      L1:
        ldarg 0
        ldc.i8 1
        beq L2
        ldarg 0
        ldc.i8 2
        rem
        ldc.i8 0
        bne.un L3
        ldarg 0
        ldc.i8 2
        div
        starg 0
        br L4
      L3:
        ldc.i8 3
        ldarg 0
        mul
        ldc.i8 1
        add
        starg 0
      L4:
        ldloc 0
        ldc.i8 1
        add
        stloc 0
        br L1
      L2:
        ldloc 0
        ret
    }

    .method public static void Main() cil managed
    {
        .entrypoint
        .maxstack 2
        .locals init (int64 number)
        ldc.i8 1
        stloc 0
      L1:
        ldloc 0
        ldc.i8 11
        bge L2
        ldloc 0
        call void [System.Console]System.Console::Write(int64)
        ldstr " takes "
        call void [System.Console]System.Console::Write(string)
        ldloc 0
        call int64 Program::HailstoneSteps(int64)
        call void [System.Console]System.Console::Write(int64)
        ldstr " steps"
        call void [System.Console]System.Console::Write(string)
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
