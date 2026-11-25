long sumOfSquares(long limit) {
    long total = 0;
    for (long i = 1; i < limit + 1; i++) {
        total += square(i);
    }
    return total;
}

long square(long value) {
    return value * value;
}
