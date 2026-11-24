// Factorial in Scala, defined recursively

object Main {
    def factorial(number: Long): Long = {
        if (number <= 1) {
            return 1
        }
        return number * factorial(number - 1)
    }

    def main(args: Array[String]): Unit = {
        for (number <- 0L until 11) {
            println(s"${number}! = ${factorial(number)}")
        }
    }
}
