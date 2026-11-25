// Factorial in D, defined recursively

import std.stdio;

long factorial(long number) {
    if (number <= 1) {
        return 1;
    }
    return number * factorial(number - 1);
}

void main() {
    for (long number = 0; number < 11; number++) {
        writeln(number, "! = ", factorial(number));
    }
}
