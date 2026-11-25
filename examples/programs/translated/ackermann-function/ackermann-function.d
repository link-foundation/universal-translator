// Ackermann function in D, defined recursively

import std.stdio;

long ackermann(long first, long second) {
    if (first == 0) {
        return second + 1;
    }
    if (second == 0) {
        return ackermann(first - 1, 1);
    }
    return ackermann(first - 1, ackermann(first, second - 1));
}

void main() {
    for (long first = 0; first < 4; first++) {
        for (long second = 0; second < 5; second++) {
            writeln("ackermann(", first, ", ", second, ") = ", ackermann(first, second));
        }
    }
}
