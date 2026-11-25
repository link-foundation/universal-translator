// Sieve of Eratosthenes in Kotlin: the primes up to 100

fun main() {
    val limit = 100
    val isPrime = IntArray(limit + 1) { 1 }
    isPrime[0] = 0
    isPrime[1] = 0
    for (number in 2 until limit + 1) {
        if (isPrime[number] == 1) {
            println(number)
            var multiple = number * number
            while (multiple <= limit) {
                isPrime[multiple] = 0
                multiple += number
            }
        }
    }
}
