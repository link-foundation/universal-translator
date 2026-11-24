// Fibonacci sequence in Swift, computed iteratively

func fibonacci(_ count: Int) -> Int {
    var previous = 0
    var current = 1
    for step in 0..<count {
        let next = previous + current
        previous = current
        current = next
    }
    return previous
}

for index in 0..<21 {
    print("fibonacci(\(index)) = \(fibonacci(index))")
}
