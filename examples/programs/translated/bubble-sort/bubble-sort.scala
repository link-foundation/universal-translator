// Bubble sort in Scala: sort a list of numbers

object Main {
    def main(args: Array[String]): Unit = {
        val numbers: Array[Long] = Array(5, 3, 8, 1, 9, 2, 7)
        val count: Long = numbers.length
        for (pass <- 0L until count - 1) {
            for (index <- 0L until count - 1 - pass) {
                if (numbers(index.toInt) > numbers((index + 1).toInt)) {
                    val swap: Long = numbers(index.toInt)
                    numbers(index.toInt) = numbers((index + 1).toInt)
                    numbers((index + 1).toInt) = swap
                }
            }
        }
        for (position <- 0L until count) {
            println(numbers(position.toInt))
        }
    }
}
