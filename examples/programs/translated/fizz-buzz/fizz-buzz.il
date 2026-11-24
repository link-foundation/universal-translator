// FizzBuzz in CIL

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
        .locals init (int64)
        ldc.i8 1
        stloc 0
      L1:
        ldloc 0
        ldc.i8 101
        bge L2
        ldloc 0
        ldc.i8 15
        rem
        ldc.i8 0
        bne.un L3
        ldstr "FizzBuzz"
        call void [System.Console]System.Console::Write(string)
        call void [System.Console]System.Console::WriteLine()
        br L4
      L3:
        ldloc 0
        ldc.i8 3
        rem
        ldc.i8 0
        bne.un L5
        ldstr "Fizz"
        call void [System.Console]System.Console::Write(string)
        call void [System.Console]System.Console::WriteLine()
        br L6
      L5:
        ldloc 0
        ldc.i8 5
        rem
        ldc.i8 0
        bne.un L7
        ldstr "Buzz"
        call void [System.Console]System.Console::Write(string)
        call void [System.Console]System.Console::WriteLine()
        br L8
      L7:
        ldloc 0
        call void [System.Console]System.Console::Write(int64)
        call void [System.Console]System.Console::WriteLine()
      L8:
      L6:
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
