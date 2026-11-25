// Greatest common divisor in Kotlin, using the Euclidean algorithm

fun greatestCommonDivisor(first: Int, second: Int): Int {
    var first = first
    var second = second
    while (second != 0) {
        val remainder = first % second
        first = second
        second = remainder
    }
    return first
}

fun main() {
    println("The greatest common divisor of 1071 and 462 is ${greatestCommonDivisor(1071, 462)}")
}
