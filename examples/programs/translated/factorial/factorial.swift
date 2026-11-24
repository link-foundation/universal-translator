// Factorial in Swift, defined recursively

func factorial(_ number: Int) -> Int {
    if number <= 1 {
        return 1
    }
    return number * factorial(number - 1)
}

for number in 0..<11 {
    print("\(number)! = \(factorial(number))")
}
