// Towers of Hanoi in CIL, solved recursively

.assembly extern System.Runtime { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly extern System.Console { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly Program { }

.class public abstract sealed auto ansi Program
  extends [System.Runtime]System.Object
{
    .method public static void MoveDisks(int64 count, int64 source, int64 target, int64 spare) cil managed
    {
        .maxstack 4
        ldarg 0
        ldc.i8 0
        bne.un L1
        ret
        br L2
      L1:
      L2:
        ldarg 0
        ldc.i8 1
        sub
        ldarg 1
        ldarg 3
        ldarg 2
        call void Program::MoveDisks(int64, int64, int64, int64)
        ldstr "Move disk "
        call void [System.Console]System.Console::Write(string)
        ldarg 0
        call void [System.Console]System.Console::Write(int64)
        ldstr " from "
        call void [System.Console]System.Console::Write(string)
        ldarg 1
        call void [System.Console]System.Console::Write(int64)
        ldstr " to "
        call void [System.Console]System.Console::Write(string)
        ldarg 2
        call void [System.Console]System.Console::Write(int64)
        call void [System.Console]System.Console::WriteLine()
        ldarg 0
        ldc.i8 1
        sub
        ldarg 3
        ldarg 2
        ldarg 1
        call void Program::MoveDisks(int64, int64, int64, int64)
        ret
    }

    .method public static void Main() cil managed
    {
        .entrypoint
        .maxstack 4
        ldc.i8 4
        ldc.i8 1
        ldc.i8 3
        ldc.i8 2
        call void Program::MoveDisks(int64, int64, int64, int64)
        ret
    }
}
