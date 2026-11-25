static int sumOfSquares(int limit) {
    int total = 0;
    for (int i = 1; i < limit + 1; i++) {
        total += square(i);
    }
    return total;
}

static int square(int value) {
    return value * value;
}
