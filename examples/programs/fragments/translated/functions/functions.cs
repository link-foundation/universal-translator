static int SumOfSquares(int limit) {
    int total = 0;
    for (int i = 1; i < limit + 1; i++) {
        total += Square(i);
    }
    return total;
}

static int Square(int value) {
    return value * value;
}
