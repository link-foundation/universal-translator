// Leap year in Groovy

boolean isLeapYear(long year) {
    return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

for (year in 1896..<1913) {
    if (isLeapYear(year)) {
        println("${year} is a leap year")
    } else {
        println("${year} is not a leap year")
    }
}
