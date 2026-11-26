// Greatest element of a list in Scala

object Main {
    def main(args: Array[String]): Unit = {
        val numbers: Array[Long] = Array(17, 4, 93, 28, 65, 3, 80)
        var greatest: Long = numbers(0)
        for (number <- numbers) {
            if (number > greatest) {
                greatest = number
            }
        }
        println(s"The greatest element is ${greatest}")
    }
}
