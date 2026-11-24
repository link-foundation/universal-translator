# Greatest common divisor in Nim, using the Euclidean algorithm

proc greatestCommonDivisor(first: int, second: int): int =
    var first = first
    var second = second
    while second != 0:
        let remainder = first mod second
        first = second
        second = remainder
    return first

echo "The greatest common divisor of 1071 and 462 is ", greatestCommonDivisor(1071, 462)
