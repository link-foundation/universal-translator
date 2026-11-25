// Perfect numbers in CIL: numbers equal to the sum of their divisors

.assembly extern System.Runtime { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly extern System.Console { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly Program { }

.class public abstract sealed auto ansi Program
  extends [System.Runtime]System.Object
{
    .method public static int64 IsPerfect(int64 number) cil managed
    {
        .maxstack 3
        .locals init (int64 sum, int64 divisor)
        ldc.i8 1
        stloc 0
        ldc.i8 2
        stloc 1
      L1:
        ldloc 1
        ldloc 1
        mul
        ldarg 0
        bgt L2
        ldarg 0
        ldloc 1
        rem
        ldc.i8 0
        bne.un L3
        ldloc 0
        ldloc 1
        add
        stloc 0
        ldloc 1
        ldloc 1
        mul
        ldarg 0
        beq L5
        ldloc 0
        ldarg 0
        ldloc 1
        div
        add
        stloc 0
        br L6
      L5:
      L6:
        br L4
      L3:
      L4:
        ldloc 1
        ldc.i8 1
        add
        stloc 1
        br L1
      L2:
        ldarg 0
        ldc.i8 1
        ble L7
        ldloc 0
        ldarg 0
        bne.un L7
        ldc.i8 1
        br L8
      L7:
        ldc.i8 0
      L8:
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
        ldc.i8 10001
        bge L2
        ldloc 0
        call int64 Program::IsPerfect(int64)
        ldc.i8 0
        beq L3
        ldloc 0
        call void [System.Console]System.Console::Write(int64)
        call void [System.Console]System.Console::WriteLine()
        br L4
      L3:
      L4:
        ldloc 0
        ldc.i8 1
        add
        stloc 0
        br L1
      L2:
        ret
    }
}
