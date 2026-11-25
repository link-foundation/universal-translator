// Greatest common divisor in Groovy, using the Euclidean algorithm

long greatestCommonDivisor(long first, long second) {
    while (second != 0) {
        long remainder = first % second
        first = second
        second = remainder
    }
    return first
}

println("The greatest common divisor of 1071 and 462 is ${greatestCommonDivisor(1071, 462)}")
