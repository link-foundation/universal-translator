// Primality by trial division in Groovy

boolean isPrime(long number) {
    if (number < 2) {
        return false
    }
    long divisor = 2
    while (divisor * divisor <= number) {
        if (number % divisor == 0) {
            return false
        }
        divisor += 1
    }
    return true
}

for (number in 1..<51) {
    if (isPrime(number)) {
        println(number)
    }
}
