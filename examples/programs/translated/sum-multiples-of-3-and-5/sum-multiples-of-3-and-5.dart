// Sum multiples of 3 and 5 in Dart: the sum of the multiples below 1000

void main() {
    var total = 0;
    for (var number = 1; number < 1000; number++) {
        if (number % 3 == 0 || number % 5 == 0) {
            total += number;
        }
    }
    print(total);
}
