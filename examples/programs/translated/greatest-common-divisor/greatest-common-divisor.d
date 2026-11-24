// Greatest common divisor in D, using the Euclidean algorithm

import std.stdio;

long greatestCommonDivisor(long first, long second) {
    while (second != 0) {
        long remainder = first % second;
        first = second;
        second = remainder;
    }
    return first;
}

void main() {
    writeln("The greatest common divisor of 1071 and 462 is ", greatestCommonDivisor(1071, 462));
}
