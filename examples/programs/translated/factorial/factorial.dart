// Factorial in Dart, defined recursively

int factorial(int number) {
    if (number <= 1) {
        return 1;
    }
    return number * factorial(number - 1);
}

void main() {
    for (var number = 0; number < 11; number++) {
        print("${number}! = ${factorial(number)}");
    }
}
