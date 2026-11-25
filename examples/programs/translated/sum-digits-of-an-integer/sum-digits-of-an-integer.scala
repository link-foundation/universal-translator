// Sum digits of an integer in Scala

object Main {
    def sumOfDigits(initialNumber: Long): Long = {
        var number: Long = initialNumber
        var total: Long = 0
        while (number > 0) {
            total += number % 10
            number /= 10
        }
        return total
    }

    def main(args: Array[String]): Unit = {
        println(s"The digits of 1234567890 sum to ${sumOfDigits(1234567890)}")
    }
}
