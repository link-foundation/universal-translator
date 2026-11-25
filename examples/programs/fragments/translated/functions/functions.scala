def sumOfSquares(limit: Long): Long = {
    var total: Long = 0
    for (i <- 1L until limit + 1) {
        total += square(i)
    }
    return total
}

def square(value: Long): Long = {
    return value * value
}
