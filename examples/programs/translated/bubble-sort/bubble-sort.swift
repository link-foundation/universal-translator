// Bubble sort in Swift: sort a list of numbers

var numbers = [5, 3, 8, 1, 9, 2, 7]
let count = numbers.count
for pass in 0..<count - 1 {
    for index in 0..<count - 1 - pass {
        if numbers[index] > numbers[index + 1] {
            let swap = numbers[index]
            numbers[index] = numbers[index + 1]
            numbers[index + 1] = swap
        }
    }
}
for position in 0..<count {
    print(numbers[position])
}
