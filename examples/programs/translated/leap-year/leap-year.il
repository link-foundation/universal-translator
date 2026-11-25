// Leap year in CIL

.assembly extern System.Runtime { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly extern System.Console { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly Program { }

.class public abstract sealed auto ansi Program
  extends [System.Runtime]System.Object
{
    .method public static int64 IsLeapYear(int64 year) cil managed
    {
        .maxstack 2
        ldarg 0
        ldc.i8 4
        rem
        ldc.i8 0
        bne.un L4
        ldarg 0
        ldc.i8 100
        rem
        ldc.i8 0
        bne.un L3
      L4:
        ldarg 0
        ldc.i8 400
        rem
        ldc.i8 0
        bne.un L1
      L3:
        ldc.i8 1
        br L2
      L1:
        ldc.i8 0
      L2:
        ret
    }

    .method public static void Main() cil managed
    {
        .entrypoint
        .maxstack 2
        .locals init (int64 year)
        ldc.i8 1896
        stloc 0
      L1:
        ldloc 0
        ldc.i8 1913
        bge L2
        ldloc 0
        call int64 Program::IsLeapYear(int64)
        ldc.i8 0
        beq L3
        ldloc 0
        call void [System.Console]System.Console::Write(int64)
        ldstr " is a leap year"
        call void [System.Console]System.Console::Write(string)
        call void [System.Console]System.Console::WriteLine()
        br L4
      L3:
        ldloc 0
        call void [System.Console]System.Console::Write(int64)
        ldstr " is not a leap year"
        call void [System.Console]System.Console::Write(string)
        call void [System.Console]System.Console::WriteLine()
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
