// Sum digits of an integer in Swift

func sumOfDigits(_ number: Int) -> Int {
    var number = number
    var total = 0
    while number > 0 {
        total += number % 10
        number /= 10
    }
    return total
}

print("The digits of 1234567890 sum to \(sumOfDigits(1234567890))")
