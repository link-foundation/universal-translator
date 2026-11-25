// Standard-output operations of the common library for C#.
static class CommonLibrary
{
    public static void PrintLine(string text) => System.Console.Write(text + "\n");

    public static void WriteText(string text) => System.Console.Write(text);

    public static void WriteInteger(long integer) => System.Console.Write(integer);

    public static void EndLine() => System.Console.Write("\n");
}
