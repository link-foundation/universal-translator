// Standard-output operations of the common library for Scala.
object CommonLibrary {
    def printLine(text: String): Unit = print(text + "\n")

    def writeText(text: String): Unit = print(text)

    def writeInteger(integer: Long): Unit = print(integer)

    def endLine(): Unit = print("\n")
}
