// Sum and product of an array in Scala

object Main {
    def main(args: Array[String]): Unit = {
        val numbers: Array[Long] = Array(1, 2, 3, 4, 5)
        var total: Long = 0
        var product: Long = 1
        for (index <- 0L until numbers.length) {
            total += numbers(index.toInt)
            product *= numbers(index.toInt)
        }
        println(s"Sum: ${total}")
        println(s"Product: ${product}")
    }
}
