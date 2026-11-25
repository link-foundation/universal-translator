// Fibonacci sequence in D, computed iteratively

import std.stdio;

long fibonacci(long count) {
    long previous = 0;
    long current = 1;
    for (long step = 0; step < count; step++) {
        long next = previous + current;
        previous = current;
        current = next;
    }
    return previous;
}

void main() {
    for (long index = 0; index < 21; index++) {
        writeln("fibonacci(", index, ") = ", fibonacci(index));
    }
}
