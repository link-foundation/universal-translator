// Standard-output operations of the common library for Java.
final class CommonLibrary {
    private CommonLibrary() {}

    static void printLine(String text) {
        System.out.print(text + "\n");
    }

    static void writeText(String text) {
        System.out.print(text);
    }

    static void writeInteger(long integer) {
        System.out.print(integer);
    }

    static void endLine() {
        System.out.print("\n");
    }
}
