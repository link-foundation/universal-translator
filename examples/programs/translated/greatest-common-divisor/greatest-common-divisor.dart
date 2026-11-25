// Greatest common divisor in Dart, using the Euclidean algorithm

int greatestCommonDivisor(int first, int second) {
    while (second != 0) {
        final remainder = first % second;
        first = second;
        second = remainder;
    }
    return first;
}

void main() {
    print("The greatest common divisor of 1071 and 462 is ${greatestCommonDivisor(1071, 462)}");
}
