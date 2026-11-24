// Perfect numbers in Dart: numbers equal to the sum of their divisors

bool isPerfect(int number) {
    var sum = 1;
    var divisor = 2;
    while (divisor * divisor <= number) {
        if (number % divisor == 0) {
            sum += divisor;
            if (divisor * divisor != number) {
                sum += number ~/ divisor;
            }
        }
        divisor += 1;
    }
    return number > 1 && sum == number;
}

void main() {
    for (var number = 1; number < 10001; number++) {
        if (isPerfect(number)) {
            print(number);
        }
    }
}
