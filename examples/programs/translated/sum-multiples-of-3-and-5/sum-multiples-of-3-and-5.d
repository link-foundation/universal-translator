// Sum multiples of 3 and 5 in D: the sum of the multiples below 1000

import std.stdio;

void main() {
    long total = 0;
    for (long number = 1; number < 1000; number++) {
        if (number % 3 == 0 || number % 5 == 0) {
            total += number;
        }
    }
    writeln(total);
}
