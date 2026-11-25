// Sum and product of an array in D

import std.stdio;

void main() {
    long[] numbers = [1, 2, 3, 4, 5];
    long total = 0;
    long product = 1;
    for (long index = 0; index < cast(long) numbers.length; index++) {
        total += numbers[index];
        product *= numbers[index];
    }
    writeln("Sum: ", total);
    writeln("Product: ", product);
}
