// Primality by trial division in Swift

func isPrime(_ number: Int) -> Bool {
    if number < 2 {
        return false
    }
    var divisor = 2
    while divisor * divisor <= number {
        if number % divisor == 0 {
            return false
        }
        divisor += 1
    }
    return true
}

for number in 1..<51 {
    if isPrime(number) {
        print(number)
    }
}
