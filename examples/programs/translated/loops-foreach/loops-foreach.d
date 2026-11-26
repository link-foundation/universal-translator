// Loops/Foreach in D: print every element of a collection

import std.stdio;

void main() {
    long[] numbers = [1, 1, 2, 3, 5, 8, 13, 21];
    foreach (number; numbers) {
        writeln(number);
    }
}
