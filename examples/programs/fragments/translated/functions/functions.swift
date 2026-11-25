func sumOfSquares(_ limit: Int) -> Int {
    var total = 0
    for i in 1..<limit + 1 {
        total += square(i)
    }
    return total
}

func square(_ value: Int) -> Int {
    return value * value
}
