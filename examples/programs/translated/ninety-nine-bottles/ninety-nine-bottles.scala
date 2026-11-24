// 99 bottles of beer in Scala

object Main {
    def main(args: Array[String]): Unit = {
        var bottles: Long = 99
        while (bottles > 0) {
            println(s"${bottles} bottles of beer on the wall, ${bottles} bottles of beer.")
            println(s"Take one down and pass it around, ${bottles - 1} bottles of beer on the wall.")
            bottles -= 1
        }
    }
}
