// Leap year in Scala

object Main {
    def isLeapYear(year: Long): Boolean = {
        return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
    }

    def main(args: Array[String]): Unit = {
        for (year <- 1896L until 1913) {
            if (isLeapYear(year)) {
                println(s"${year} is a leap year")
            } else {
                println(s"${year} is not a leap year")
            }
        }
    }
}
