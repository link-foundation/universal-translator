// Hailstone sequence in Kotlin: count the steps to reach 1

fun hailstoneSteps(number: Int): Int {
    var number = number
    var steps = 0
    while (number != 1) {
        if (number % 2 == 0) {
            number /= 2
        } else {
            number = 3 * number + 1
        }
        steps += 1
    }
    return steps
}

fun main() {
    for (number in 1 until 11) {
        println("${number} takes ${hailstoneSteps(number)} steps")
    }
}
