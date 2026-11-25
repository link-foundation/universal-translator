// Greatest common divisor in Swift, using the Euclidean algorithm

func greatestCommonDivisor(_ first: Int, _ second: Int) -> Int {
    var first = first
    var second = second
    while second != 0 {
        let remainder = first % second
        first = second
        second = remainder
    }
    return first
}

print("The greatest common divisor of 1071 and 462 is \(greatestCommonDivisor(1071, 462))")
