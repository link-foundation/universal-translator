// Hailstone sequence in D: count the steps to reach 1

import std.stdio;

long hailstoneSteps(long number) {
    long steps = 0;
    while (number != 1) {
        if (number % 2 == 0) {
            number /= 2;
        } else {
            number = 3 * number + 1;
        }
        steps += 1;
    }
    return steps;
}

void main() {
    for (long number = 1; number < 11; number++) {
        writeln(number, " takes ", hailstoneSteps(number), " steps");
    }
}
