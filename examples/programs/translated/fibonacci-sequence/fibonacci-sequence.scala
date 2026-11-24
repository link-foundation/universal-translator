// Fibonacci sequence in Scala, computed iteratively

object Main {
    def fibonacci(count: Long): Long = {
        var previous: Long = 0
        var current: Long = 1
        for (step <- 0L until count) {
            val next: Long = previous + current
            previous = current
            current = next
        }
        return previous
    }

    def main(args: Array[String]): Unit = {
        for (index <- 0L until 21) {
            println(s"fibonacci(${index}) = ${fibonacci(index)}")
        }
    }
}
