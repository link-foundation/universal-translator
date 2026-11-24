// FizzBuzz in Scala

object Main {
    def main(args: Array[String]): Unit = {
        for (number <- 1L until 101) {
            if (number % 15 == 0) {
                println("FizzBuzz")
            } else if (number % 3 == 0) {
                println("Fizz")
            } else if (number % 5 == 0) {
                println("Buzz")
            } else {
                println(number)
            }
        }
    }
}
