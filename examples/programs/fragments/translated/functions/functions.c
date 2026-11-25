int square(int value);

int sum_of_squares(int limit) {
    int total = 0;
    for (int i = 1; i < limit + 1; i++) {
        total += square(i);
    }
    return total;
}

int square(int value) {
    return value * value;
}
