// Sum of squares in Dart

int sumOfSquares(int limit) {
    var total = 0;
    var number = 1;
    while (number <= limit) {
        total += number * number;
        number += 1;
    }
    return total;
}

void main() {
    final limit = 10;
    print("Sum of squares from 1 to ${limit}:");
    print(sumOfSquares(limit));
}
