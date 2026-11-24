// Sum digits of an integer in D

import std.stdio;

long sumOfDigits(long number) {
    long total = 0;
    while (number > 0) {
        total += number % 10;
        number /= 10;
    }
    return total;
}

void main() {
    writeln("The digits of 1234567890 sum to ", sumOfDigits(1234567890));
}
