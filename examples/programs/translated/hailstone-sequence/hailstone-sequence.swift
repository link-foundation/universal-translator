// Hailstone sequence in Swift: count the steps to reach 1

func hailstoneSteps(_ number: Int) -> Int {
    var number = number
    var steps = 0
    while number != 1 {
        if number % 2 == 0 {
            number /= 2
        } else {
            number = 3 * number + 1
        }
        steps += 1
    }
    return steps
}

for number in 1..<11 {
    print("\(number) takes \(hailstoneSteps(number)) steps")
}
