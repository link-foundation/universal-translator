// Perfect numbers in Groovy: numbers equal to the sum of their divisors

boolean isPerfect(long number) {
    long sum = 1
    long divisor = 2
    while (divisor * divisor <= number) {
        if (number % divisor == 0) {
            sum += divisor
            if (divisor * divisor != number) {
                sum += number.intdiv(divisor)
            }
        }
        divisor += 1
    }
    return number > 1 && sum == number
}

for (number in 1..<10001) {
    if (isPerfect(number)) {
        println(number)
    }
}
