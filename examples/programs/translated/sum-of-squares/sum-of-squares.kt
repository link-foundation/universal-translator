// Sum of squares in Kotlin

fun sumOfSquares(limit: Int): Int {
    var total = 0
    var number = 1
    while (number <= limit) {
        total += number * number
        number += 1
    }
    return total
}

fun main() {
    val limit = 10
    println("Sum of squares from 1 to ${limit}:")
    println(sumOfSquares(limit))
}
