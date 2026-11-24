// Fibonacci sequence in Kotlin, computed iteratively

fun fibonacci(count: Int): Int {
    var previous = 0
    var current = 1
    for (step in 0 until count) {
        val next = previous + current
        previous = current
        current = next
    }
    return previous
}

fun main() {
    for (index in 0 until 21) {
        println("fibonacci(${index}) = ${fibonacci(index)}")
    }
}
