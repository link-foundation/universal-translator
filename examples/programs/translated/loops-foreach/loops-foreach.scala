// Loops/Foreach in Scala: print every element of a collection

object Main {
    def main(args: Array[String]): Unit = {
        val numbers: Array[Long] = Array(1, 1, 2, 3, 5, 8, 13, 21)
        for (number <- numbers) {
            println(number)
        }
    }
}
