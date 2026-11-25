// Sum digits of an integer in Dart

int sumOfDigits(int number) {
    var total = 0;
    while (number > 0) {
        total += number % 10;
        number = number ~/ 10;
    }
    return total;
}

void main() {
    print("The digits of 1234567890 sum to ${sumOfDigits(1234567890)}");
}
