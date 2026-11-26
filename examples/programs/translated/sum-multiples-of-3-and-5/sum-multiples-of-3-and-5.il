// Sum multiples of 3 and 5 in CIL: the sum of the multiples below 1000

.assembly extern System.Runtime { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly extern System.Console { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly Program { }

.class public abstract sealed auto ansi Program
  extends [System.Runtime]System.Object
{
    .method public static void Main() cil managed
    {
        .entrypoint
        .maxstack 2
        .locals init (int64 total, int64 number)
        ldc.i8 0
        stloc 0
        ldc.i8 1
        stloc 1
      L1:
        ldloc 1
        ldc.i8 1000
        bge L2
        ldloc 1
        ldc.i8 3
        rem
        ldc.i8 0
        beq L5
        ldloc 1
        ldc.i8 5
        rem
        ldc.i8 0
        bne.un L3
      L5:
        ldloc 0
        ldloc 1
        add
        stloc 0
        br L4
      L3:
      L4:
        ldloc 1
        ldc.i8 1
        add
        stloc 1
        br L1
      L2:
        ldloc 0
        call void [System.Console]System.Console::Write(int64)
        call void [System.Console]System.Console::WriteLine()
        ret
    }
}
