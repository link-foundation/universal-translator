long sumOfSquares(long limit) {
    long total = 0
    for (i in 1..<limit + 1) {
        total += square(i)
    }
    return total
}

long square(long value) {
    return value * value
}
