fun sumOfSquares(limit: Int): Int {
    var total = 0
    for (i in 1 until limit + 1) {
        total += square(i)
    }
    return total
}

fun square(value: Int): Int {
    return value * value
}
