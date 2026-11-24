// Primality by trial division in CIL

.assembly extern System.Runtime { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly extern System.Console { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly Program { }

.class public abstract sealed auto ansi Program
  extends [System.Runtime]System.Object
{
    .method public static int64 IsPrime(int64 number) cil managed
    {
        .maxstack 2
        .locals init (int64 divisor)
        ldarg 0
        ldc.i8 2
        bge L1
        ldc.i8 0
        ret
        br L2
      L1:
      L2:
        ldc.i8 2
        stloc 0
      L3:
        ldloc 0
        ldloc 0
        mul
        ldarg 0
        bgt L4
        ldarg 0
        ldloc 0
        rem
        ldc.i8 0
        bne.un L5
        ldc.i8 0
        ret
        br L6
      L5:
      L6:
        ldloc 0
        ldc.i8 1
        add
        stloc 0
        br L3
      L4:
        ldc.i8 1
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
        ldc.i8 51
        bge L2
        ldloc 0
        call int64 Program::IsPrime(int64)
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
