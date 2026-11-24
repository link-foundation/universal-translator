// Perfect numbers in Swift: numbers equal to the sum of their divisors

func isPerfect(_ number: Int) -> Bool {
    var sum = 1
    var divisor = 2
    while divisor * divisor <= number {
        if number % divisor == 0 {
            sum += divisor
            if divisor * divisor != number {
                sum += number / divisor
            }
        }
        divisor += 1
    }
    return number > 1 && sum == number
}

for number in 1..<10001 {
    if isPerfect(number) {
        print(number)
    }
}
