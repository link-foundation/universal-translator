// FizzBuzz in D

import std.stdio;

void main() {
    for (long number = 1; number < 101; number++) {
        if (number % 15 == 0) {
            writeln("FizzBuzz");
        } else if (number % 3 == 0) {
            writeln("Fizz");
        } else if (number % 5 == 0) {
            writeln("Buzz");
        } else {
            writeln(number);
        }
    }
}
