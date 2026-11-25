# Sieve of Eratosthenes in R: the primes up to 100

limit <- 100L
is_prime <- rep(1L, limit + 1L)
is_prime[1L] <- 0L
is_prime[2L] <- 0L
number <- 2L
while (number < limit + 1L) {
    if (is_prime[number + 1L] == 1L) {
        cat(number, "\n", sep = "")
        multiple <- number * number
        while (multiple <= limit) {
            is_prime[multiple + 1L] <- 0L
            multiple <- multiple + number
        }
    }
    number <- number + 1L
}
