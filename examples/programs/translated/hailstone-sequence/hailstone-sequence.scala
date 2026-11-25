// Hailstone sequence in Scala: count the steps to reach 1

object Main {
    def hailstoneSteps(initialNumber: Long): Long = {
        var number: Long = initialNumber
        var steps: Long = 0
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

    def main(args: Array[String]): Unit = {
        for (number <- 1L until 11) {
            println(s"${number} takes ${hailstoneSteps(number)} steps")
        }
    }
}
