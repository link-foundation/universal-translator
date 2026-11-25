// Ackermann method in CIL, defined recursively

.assembly extern System.Runtime { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly extern System.Console { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly Program { }

.class public abstract sealed auto ansi Program
  extends [System.Runtime]System.Object
{
    .method public static int64 Ackermann(int64 first, int64 second) cil managed
    {
        .maxstack 4
        ldarg 0
        ldc.i8 0
        bne.un L1
        ldarg 1
        ldc.i8 1
        add
        ret
        br L2
      L1:
      L2:
        ldarg 1
        ldc.i8 0
        bne.un L3
        ldarg 0
        ldc.i8 1
        sub
        ldc.i8 1
        call int64 Program::Ackermann(int64, int64)
        ret
        br L4
      L3:
      L4:
        ldarg 0
        ldc.i8 1
        sub
        ldarg 0
        ldarg 1
        ldc.i8 1
        sub
        call int64 Program::Ackermann(int64, int64)
        call int64 Program::Ackermann(int64, int64)
        ret
    }

    .method public static void Main() cil managed
    {
        .entrypoint
        .maxstack 2
        .locals init (int64 first, int64 second)
        ldc.i8 0
        stloc 0
      L1:
        ldloc 0
        ldc.i8 4
        bge L2
        ldc.i8 0
        stloc 1
      L3:
        ldloc 1
        ldc.i8 5
        bge L4
        ldstr "ackermann("
        call void [System.Console]System.Console::Write(string)
        ldloc 0
        call void [System.Console]System.Console::Write(int64)
        ldstr ", "
        call void [System.Console]System.Console::Write(string)
        ldloc 1
        call void [System.Console]System.Console::Write(int64)
        ldstr ") = "
        call void [System.Console]System.Console::Write(string)
        ldloc 0
        ldloc 1
        call int64 Program::Ackermann(int64, int64)
        call void [System.Console]System.Console::Write(int64)
        call void [System.Console]System.Console::WriteLine()
        ldloc 1
        ldc.i8 1
        add
        stloc 1
        br L3
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
