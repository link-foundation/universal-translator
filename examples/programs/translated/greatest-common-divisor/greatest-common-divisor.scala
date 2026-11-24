// Greatest common divisor in Scala, using the Euclidean algorithm

object Main {
    def greatestCommonDivisor(initialFirst: Long, initialSecond: Long): Long = {
        var first: Long = initialFirst
        var second: Long = initialSecond
        while (second != 0) {
            val remainder: Long = first % second
            first = second
            second = remainder
        }
        return first
    }

    def main(args: Array[String]): Unit = {
        println(s"The greatest common divisor of 1071 and 462 is ${greatestCommonDivisor(1071, 462)}")
    }
}
