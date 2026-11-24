// Primality by trial division in Kotlin

fun isPrime(number: Int): Boolean {
    if (number < 2) {
        return false
    }
    var divisor = 2
    while (divisor * divisor <= number) {
        if (number % divisor == 0) {
            return false
        }
        divisor += 1
    }
    return true
}

fun main() {
    for (number in 1 until 51) {
        if (isPrime(number)) {
            println(number)
        }
    }
}
