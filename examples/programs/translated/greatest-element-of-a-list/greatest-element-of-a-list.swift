// Greatest element of a list in Swift

let numbers = [17, 4, 93, 28, 65, 3, 80]
var greatest = numbers[0]
for number in numbers {
    if number > greatest {
        greatest = number
    }
}
print("The greatest element is \(greatest)")
