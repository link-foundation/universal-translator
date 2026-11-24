// Factorial in Kotlin, defined recursively

fun factorial(number: Int): Int {
    if (number <= 1) {
        return 1
    }
    return number * factorial(number - 1)
}

fun main() {
    for (number in 0 until 11) {
        println("${number}! = ${factorial(number)}")
    }
}
