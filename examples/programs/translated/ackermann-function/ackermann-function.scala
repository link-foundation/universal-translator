// Ackermann method in Scala, defined recursively

object Main {
    def ackermann(first: Long, second: Long): Long = {
        if (first == 0) {
            return second + 1
        }
        if (second == 0) {
            return ackermann(first - 1, 1)
        }
        return ackermann(first - 1, ackermann(first, second - 1))
    }

    def main(args: Array[String]): Unit = {
        for (first <- 0L until 4) {
            for (second <- 0L until 5) {
                println(s"ackermann(${first}, ${second}) = ${ackermann(first, second)}")
            }
        }
    }
}
