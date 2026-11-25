// Primality by trial division in Scala

object Main {
    def isPrime(number: Long): Boolean = {
        if (number < 2) {
            return false
        }
        var divisor: Long = 2
        while (divisor * divisor <= number) {
            if (number % divisor == 0) {
                return false
            }
            divisor += 1
        }
        return true
    }

    def main(args: Array[String]): Unit = {
        for (number <- 1L until 51) {
            if (isPrime(number)) {
                println(number)
            }
        }
    }
}
