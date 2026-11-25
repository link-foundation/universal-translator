// Hello World in CIL

.assembly extern System.Runtime { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly extern System.Console { .publickeytoken = (B0 3F 5F 7F 11 D5 0A 3A) .ver 4:0:0:0 }
.assembly Program { }

.class public abstract sealed auto ansi Program
  extends [System.Runtime]System.Object
{
    .method public static void Main() cil managed
    {
        .entrypoint
        .maxstack 1
        // print "Hello World!" into console followed by new line symbol by method call
        ldstr "Hello World!"
        call void [System.Console]System.Console::Write(string)
        call void [System.Console]System.Console::WriteLine()
        ret
    }
}
