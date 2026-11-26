// Greatest element of a list in D

import std.stdio;

void main() {
    long[] numbers = [17, 4, 93, 28, 65, 3, 80];
    long greatest = numbers[0];
    foreach (number; numbers) {
        if (number > greatest) {
            greatest = number;
        }
    }
    writeln("The greatest element is ", greatest);
}
