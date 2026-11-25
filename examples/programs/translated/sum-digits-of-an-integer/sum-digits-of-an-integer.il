// Sum digits of an integer in CIL

.assembly extern System.Runtime { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly extern System.Console { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly Program { }

.class public abstract sealed auto ansi Program
  extends [System.Runtime]System.Object
{
    .method public static int64 SumOfDigits(int64 number) cil managed
    {
        .maxstack 3
        .locals init (int64 total)
        ldc.i8 0
        stloc 0
      L1:
        ldarg 0
        ldc.i8 0
        ble L2
        ldloc 0
        ldarg 0
        ldc.i8 10
        rem
        add
        stloc 0
        ldarg 0
        ldc.i8 10
        div
        starg 0
        br L1
      L2:
        ldloc 0
        ret
    }

    .method public static void Main() cil managed
    {
        .entrypoint
        .maxstack 1
        ldstr "The digits of 1234567890 sum to "
        call void [System.Console]System.Console::Write(string)
        ldc.i8 1234567890
        call int64 Program::SumOfDigits(int64)
        call void [System.Console]System.Console::Write(int64)
        call void [System.Console]System.Console::WriteLine()
        ret
    }
}
