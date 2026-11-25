// Bubble sort in D: sort a list of numbers

import std.stdio;

void main() {
    long[] numbers = [5, 3, 8, 1, 9, 2, 7];
    long count = cast(long) numbers.length;
    for (long pass = 0; pass < count - 1; pass++) {
        for (long index = 0; index < count - 1 - pass; index++) {
            if (numbers[index] > numbers[index + 1]) {
                long swap = numbers[index];
                numbers[index] = numbers[index + 1];
                numbers[index + 1] = swap;
            }
        }
    }
    for (long position = 0; position < count; position++) {
        writeln(numbers[position]);
    }
}
