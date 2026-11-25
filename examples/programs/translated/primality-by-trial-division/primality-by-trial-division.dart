// Primality by trial division in Dart

bool isPrime(int number) {
    if (number < 2) {
        return false;
    }
    var divisor = 2;
    while (divisor * divisor <= number) {
        if (number % divisor == 0) {
            return false;
        }
        divisor += 1;
    }
    return true;
}

void main() {
    for (var number = 1; number < 51; number++) {
        if (isPrime(number)) {
            print(number);
        }
    }
}
