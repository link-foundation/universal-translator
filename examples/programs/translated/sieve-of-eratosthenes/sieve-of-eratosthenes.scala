// Sieve of Eratosthenes in Scala: the primes up to 100

object Main {
    def main(args: Array[String]): Unit = {
        val limit: Long = 100
        val isPrime: Array[Long] = Array.fill((limit + 1).toInt)(1)
        isPrime(0) = 0
        isPrime(1) = 0
        for (number <- 2L until limit + 1) {
            if (isPrime(number.toInt) == 1) {
                println(number)
                var multiple: Long = number * number
                while (multiple <= limit) {
                    isPrime(multiple.toInt) = 0
                    multiple += number
                }
            }
        }
    }
}
