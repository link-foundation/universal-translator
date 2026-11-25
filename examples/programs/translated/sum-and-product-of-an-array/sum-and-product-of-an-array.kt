// Sum and product of an array in Kotlin

fun main() {
    val numbers = intArrayOf(1, 2, 3, 4, 5)
    var total = 0
    var product = 1
    for (index in 0 until numbers.size) {
        total += numbers[index]
        product *= numbers[index]
    }
    println("Sum: ${total}")
    println("Product: ${product}")
}
