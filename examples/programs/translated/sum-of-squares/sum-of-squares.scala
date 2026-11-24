// Sum of squares in Scala

object Main {
    def sumOfSquares(limit: Long): Long = {
        var total: Long = 0
        var number: Long = 1
        while (number <= limit) {
            total += number * number
            number += 1
        }
        return total
    }

    def main(args: Array[String]): Unit = {
        val limit: Long = 10
        println(s"Sum of squares from 1 to ${limit}:")
        println(sumOfSquares(limit))
    }
}
