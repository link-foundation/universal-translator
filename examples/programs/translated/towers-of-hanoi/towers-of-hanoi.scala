// Towers of Hanoi in Scala, solved recursively

object Main {
    def moveDisks(count: Long, source: Long, target: Long, spare: Long): Unit = {
        if (count == 0) {
            return
        }
        moveDisks(count - 1, source, spare, target)
        println(s"Move disk ${count} from ${source} to ${target}")
        moveDisks(count - 1, spare, target, source)
    }

    def main(args: Array[String]): Unit = {
        moveDisks(4, 1, 3, 2)
    }
}
