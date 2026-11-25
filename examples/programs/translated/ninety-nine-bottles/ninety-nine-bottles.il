// 99 bottles of beer in CIL

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
        .locals init (int64 bottles)
        ldc.i8 99
        stloc 0
      L1:
        ldloc 0
        ldc.i8 0
        ble L2
        ldloc 0
        call void [System.Console]System.Console::Write(int64)
        ldstr " bottles of beer on the wall, "
        call void [System.Console]System.Console::Write(string)
        ldloc 0
        call void [System.Console]System.Console::Write(int64)
        ldstr " bottles of beer."
        call void [System.Console]System.Console::Write(string)
        call void [System.Console]System.Console::WriteLine()
        ldstr "Take one down and pass it around, "
        call void [System.Console]System.Console::Write(string)
        ldloc 0
        ldc.i8 1
        sub
        call void [System.Console]System.Console::Write(int64)
        ldstr " bottles of beer on the wall."
        call void [System.Console]System.Console::Write(string)
        call void [System.Console]System.Console::WriteLine()
        ldloc 0
        ldc.i8 1
        sub
        stloc 0
        br L1
      L2:
        ret
    }
}
