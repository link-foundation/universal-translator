// Linear search in D: find the position of a value in a list

import std.stdio;

void main() {
    long[] numbers = [31, 41, 59, 26, 53, 58, 97, 93];
    long wanted = 53;
    long position = -1;
    long current = 0;
    foreach (number; numbers) {
        if (number == wanted && position < 0) {
            position = current;
        }
        current += 1;
    }
    writeln("Found ", wanted, " at position ", position);
}
