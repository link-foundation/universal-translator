// Sieve of Eratosthenes in Groovy: the primes up to 100

long limit = 100
List<Long> isPrime = [1] * (limit + 1)
isPrime[0] = 0
isPrime[1] = 0
for (number in 2..<limit + 1) {
    if (isPrime[number] == 1) {
        println(number)
        long multiple = number * number
        while (multiple <= limit) {
            isPrime[multiple] = 0
            multiple += number
        }
    }
}
