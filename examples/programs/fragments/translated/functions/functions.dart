int sumOfSquares(int limit) {
    var total = 0;
    for (var i = 1; i < limit + 1; i++) {
        total += square(i);
    }
    return total;
}

int square(int value) {
    return value * value;
}
