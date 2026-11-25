// Ackermann function in Kotlin, defined recursively

fun ackermann(first: Int, second: Int): Int {
    if (first == 0) {
        return second + 1
    }
    if (second == 0) {
        return ackermann(first - 1, 1)
    }
    return ackermann(first - 1, ackermann(first, second - 1))
}

fun main() {
    for (first in 0 until 4) {
        for (second in 0 until 5) {
            println("ackermann(${first}, ${second}) = ${ackermann(first, second)}")
        }
    }
}
