// Mutual recursion in Scala: the Hofstadter Female and Male sequences

object Main {
    def female(index: Long): Long = {
        if (index == 0) {
            return 1
        }
        return index - male(female(index - 1))
    }

    def male(index: Long): Long = {
        if (index == 0) {
            return 0
        }
        return index - female(male(index - 1))
    }

    def main(args: Array[String]): Unit = {
        for (index <- 0L until 20) {
            println(s"${index}: ${female(index)} ${male(index)}")
        }
    }
}
