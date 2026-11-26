// Sum multiples of 3 and 5 in Scala: the sum of the multiples below 1000

object Main {
    def main(args: Array[String]): Unit = {
        var total: Long = 0
        for (number <- 1L until 1000) {
            if (number % 3 == 0 || number % 5 == 0) {
                total += number
            }
        }
        println(total)
    }
}
