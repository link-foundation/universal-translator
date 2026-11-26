// Linear search in Scala: find the position of a value in a list

object Main {
    def main(args: Array[String]): Unit = {
        val numbers: Array[Long] = Array(31, 41, 59, 26, 53, 58, 97, 93)
        val wanted: Long = 53
        var position: Long = -1
        var current: Long = 0
        for (number <- numbers) {
            if (number == wanted && position < 0) {
                position = current
            }
            current += 1
        }
        println(s"Found ${wanted} at position ${position}")
    }
}
