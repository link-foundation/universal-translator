// Hailstone sequence in Groovy: count the steps to reach 1

long hailstoneSteps(long number) {
    long steps = 0
    while (number != 1) {
        if (number % 2 == 0) {
            number = number.intdiv(2)
        } else {
            number = 3 * number + 1
        }
        steps += 1
    }
    return steps
}

for (number in 1..<11) {
    println("${number} takes ${hailstoneSteps(number)} steps")
}
