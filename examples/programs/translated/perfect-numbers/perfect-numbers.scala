// Perfect numbers in Scala: numbers equal to the sum of their divisors

object Main {
    def isPerfect(number: Long): Boolean = {
        var sum: Long = 1
        var divisor: Long = 2
        while (divisor * divisor <= number) {
            if (number % divisor == 0) {
                sum += divisor
                if (divisor * divisor != number) {
                    sum += number / divisor
                }
            }
            divisor += 1
        }
        return number > 1 && sum == number
    }

    def main(args: Array[String]): Unit = {
        for (number <- 1L until 10001) {
            if (isPerfect(number)) {
                println(number)
            }
        }
    }
}
