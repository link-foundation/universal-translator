// Perfect numbers in Kotlin: numbers equal to the sum of their divisors

fun isPerfect(number: Int): Boolean {
    var sum = 1
    var divisor = 2
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

fun main() {
    for (number in 1 until 10001) {
        if (isPerfect(number)) {
            println(number)
        }
    }
}
