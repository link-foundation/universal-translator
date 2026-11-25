// Bubble sort in CIL: sort a list of numbers

.assembly extern System.Runtime { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly extern System.Console { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly Program { }

.class public abstract sealed auto ansi Program
  extends [System.Runtime]System.Object
{
    .method public static void Main() cil managed
    {
        .entrypoint
        .maxstack 5
        .locals init (int64[] numbers, int64 count, int64 pass, int64 index, int64 swap, int64 position)
        ldc.i8 7
        ldc.i8 0
        call int64[] Program::NewArray(int64, int64)
        dup
        ldc.i8 0
        conv.ovf.i
        ldc.i8 5
        stelem.i8
        dup
        ldc.i8 1
        conv.ovf.i
        ldc.i8 3
        stelem.i8
        dup
        ldc.i8 2
        conv.ovf.i
        ldc.i8 8
        stelem.i8
        dup
        ldc.i8 3
        conv.ovf.i
        ldc.i8 1
        stelem.i8
        dup
        ldc.i8 4
        conv.ovf.i
        ldc.i8 9
        stelem.i8
        dup
        ldc.i8 5
        conv.ovf.i
        ldc.i8 2
        stelem.i8
        dup
        ldc.i8 6
        conv.ovf.i
        ldc.i8 7
        stelem.i8
        stloc 0
        ldloc 0
        ldlen
        conv.i8
        stloc 1
        ldc.i8 0
        stloc 2
      L1:
        ldloc 2
        ldloc 1
        ldc.i8 1
        sub
        bge L2
        ldc.i8 0
        stloc 3
      L3:
        ldloc 3
        ldloc 1
        ldc.i8 1
        sub
        ldloc 2
        sub
        bge L4
        ldloc 0
        ldloc 3
        conv.ovf.i
        ldelem.i8
        ldloc 0
        ldloc 3
        ldc.i8 1
        add
        conv.ovf.i
        ldelem.i8
        ble L5
        ldloc 0
        ldloc 3
        conv.ovf.i
        ldelem.i8
        stloc 4
        ldloc 0
        ldloc 3
        conv.ovf.i
        ldloc 0
        ldloc 3
        ldc.i8 1
        add
        conv.ovf.i
        ldelem.i8
        stelem.i8
        ldloc 0
        ldloc 3
        ldc.i8 1
        add
        conv.ovf.i
        ldloc 4
        stelem.i8
        br L6
      L5:
      L6:
        ldloc 3
        ldc.i8 1
        add
        stloc 3
        br L3
      L4:
        ldloc 2
        ldc.i8 1
        add
        stloc 2
        br L1
      L2:
        ldc.i8 0
        stloc 5
      L7:
        ldloc 5
        ldloc 1
        bge L8
        ldloc 0
        ldloc 5
        conv.ovf.i
        ldelem.i8
        call void [System.Console]System.Console::Write(int64)
        call void [System.Console]System.Console::WriteLine()
        ldloc 5
        ldc.i8 1
        add
        stloc 5
        br L7
      L8:
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
