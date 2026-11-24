// Primality by trial division in D

import std.stdio;

bool isPrime(long number) {
    if (number < 2) {
        return false;
    }
    long divisor = 2;
    while (divisor * divisor <= number) {
        if (number % divisor == 0) {
            return false;
        }
        divisor += 1;
    }
    return true;
}

void main() {
    for (long number = 1; number < 51; number++) {
        if (isPrime(number)) {
            writeln(number);
        }
    }
}
