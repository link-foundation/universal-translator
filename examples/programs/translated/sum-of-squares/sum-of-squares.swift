// Sum of squares in Swift

func sumOfSquares(_ limit: Int) -> Int {
    var total = 0
    var number = 1
    while number <= limit {
        total += number * number
        number += 1
    }
    return total
}

let limit = 10
print("Sum of squares from 1 to \(limit):")
print(sumOfSquares(limit))
