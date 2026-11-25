// Factorial in Groovy, defined recursively

long factorial(long number) {
    if (number <= 1) {
        return 1
    }
    return number * factorial(number - 1)
}

for (number in 0..<11) {
    println("${number}! = ${factorial(number)}")
}
