// Sum multiples of 3 and 5 in Swift: the sum of the multiples below 1000

var total = 0
for number in 1..<1000 {
    if number % 3 == 0 || number % 5 == 0 {
        total += number
    }
}
print(total)
