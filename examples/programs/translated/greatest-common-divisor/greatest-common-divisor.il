// Greatest common divisor in CIL, using the Euclidean algorithm

.assembly extern System.Runtime { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly extern System.Console { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly Program { }

.class public abstract sealed auto ansi Program
  extends [System.Runtime]System.Object
{
    .method public static int64 GreatestCommonDivisor(int64 first, int64 second) cil managed
    {
        .maxstack 2
        .locals init (int64 remainder)
      L1:
        ldarg 1
        ldc.i8 0
        beq L2
        ldarg 0
        ldarg 1
        rem
        stloc 0
        ldarg 1
        starg 0
        ldloc 0
        starg 1
        br L1
      L2:
        ldarg 0
        ret
    }

    .method public static void Main() cil managed
    {
        .entrypoint
        .maxstack 2
        ldstr "The greatest common divisor of 1071 and 462 is "
        call void [System.Console]System.Console::Write(string)
        ldc.i8 1071
        ldc.i8 462
        call int64 Program::GreatestCommonDivisor(int64, int64)
        call void [System.Console]System.Console::Write(int64)
        call void [System.Console]System.Console::WriteLine()
        ret
    }
}
