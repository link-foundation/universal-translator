// Perfect numbers in D: numbers equal to the sum of their divisors

import std.stdio;

bool isPerfect(long number) {
    long sum = 1;
    long divisor = 2;
    while (divisor * divisor <= number) {
        if (number % divisor == 0) {
            sum += divisor;
            if (divisor * divisor != number) {
                sum += number / divisor;
            }
        }
        divisor += 1;
    }
    return number > 1 && sum == number;
}

void main() {
    for (long number = 1; number < 10001; number++) {
        if (isPerfect(number)) {
            writeln(number);
        }
    }
}
