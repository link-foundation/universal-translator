// Sum digits of an integer in Groovy

long sumOfDigits(long number) {
    long total = 0
    while (number > 0) {
        total += number % 10
        number = number.intdiv(10)
    }
    return total
}

println("The digits of 1234567890 sum to ${sumOfDigits(1234567890)}")
