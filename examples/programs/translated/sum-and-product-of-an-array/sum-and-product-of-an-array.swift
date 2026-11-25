// Sum and product of an array in Swift

let numbers = [1, 2, 3, 4, 5]
var total = 0
var product = 1
for index in 0..<numbers.count {
    total += numbers[index]
    product *= numbers[index]
}
print("Sum: \(total)")
print("Product: \(product)")
