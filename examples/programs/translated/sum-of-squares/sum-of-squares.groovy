// Sum of squares in Groovy

long sumOfSquares(long limit) {
    long total = 0
    long number = 1
    while (number <= limit) {
        total += number * number
        number += 1
    }
    return total
}

long limit = 10
println("Sum of squares from 1 to ${limit}:")
println(sumOfSquares(limit))
