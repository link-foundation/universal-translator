# Linear search in Nim: find the position of a value in a list

let numbers = @[31, 41, 59, 26, 53, 58, 97, 93]
let wanted = 53
var position = -1
var current = 0
for number in numbers:
    if number == wanted and position < 0:
        position = current
    current += 1
echo "Found ", wanted, " at position ", position
