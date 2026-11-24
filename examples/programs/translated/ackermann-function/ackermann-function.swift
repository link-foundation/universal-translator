// Ackermann function in Swift, defined recursively

func ackermann(_ first: Int, _ second: Int) -> Int {
    if first == 0 {
        return second + 1
    }
    if second == 0 {
        return ackermann(first - 1, 1)
    }
    return ackermann(first - 1, ackermann(first, second - 1))
}

for first in 0..<4 {
    for second in 0..<5 {
        print("ackermann(\(first), \(second)) = \(ackermann(first, second))")
    }
}
