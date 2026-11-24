// Sum of squares in D

import std.stdio;

long sumOfSquares(long limit) {
    long total = 0;
    long number = 1;
    while (number <= limit) {
        total += number * number;
        number += 1;
    }
    return total;
}

void main() {
    long limit = 10;
    writeln("Sum of squares from 1 to ", limit, ":");
    writeln(sumOfSquares(limit));
}
