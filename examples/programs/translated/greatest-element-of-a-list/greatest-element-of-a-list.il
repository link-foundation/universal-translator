// Greatest element of a list in CIL

.assembly extern System.Runtime { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly extern System.Console { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly Program { }

.class public abstract sealed auto ansi Program
  extends [System.Runtime]System.Object
{
    .method public static void Main() cil managed
    {
        .entrypoint
        .maxstack 4
        .locals init (int64[] numbers, int64 greatest, int64 index, int64 number)
        ldc.i8 7
        ldc.i8 0
        call int64[] Program::NewArray(int64, int64)
        dup
        ldc.i8 0
        conv.ovf.i
        ldc.i8 17
        stelem.i8
        dup
        ldc.i8 1
        conv.ovf.i
        ldc.i8 4
        stelem.i8
        dup
        ldc.i8 2
        conv.ovf.i
        ldc.i8 93
        stelem.i8
        dup
        ldc.i8 3
        conv.ovf.i
        ldc.i8 28
        stelem.i8
        dup
        ldc.i8 4
        conv.ovf.i
        ldc.i8 65
        stelem.i8
        dup
        ldc.i8 5
        conv.ovf.i
        ldc.i8 3
        stelem.i8
        dup
        ldc.i8 6
        conv.ovf.i
        ldc.i8 80
        stelem.i8
        stloc 0
        ldloc 0
        ldc.i8 0
        conv.ovf.i
        ldelem.i8
        stloc 1
        ldc.i8 0
        stloc 2
      L1:
        ldloc 2
        ldloc 0
        ldlen
        conv.i8
        bge L2
        ldloc 0
        ldloc 2
        conv.ovf.i
        ldelem.i8
        stloc 3
        ldloc 3
        ldloc 1
        ble L3
        ldloc 3
        stloc 1
        br L4
      L3:
      L4:
        ldloc 2
        ldc.i8 1
        add
        stloc 2
        br L1
      L2:
        ldstr "The greatest element is "
        call void [System.Console]System.Console::Write(string)
        ldloc 1
        call void [System.Console]System.Console::Write(int64)
        call void [System.Console]System.Console::WriteLine()
        ret
    }

    .method private static int64[] NewArray(int64 length, int64 fill) cil managed
    {
        .maxstack 3
        ldarg 0
        conv.ovf.i
        newarr [System.Runtime]System.Int64
        dup
        ldarg 1
        call void [System.Runtime]System.Array::Fill<int64>(!!0[], !!0)
        ret
    }
}
