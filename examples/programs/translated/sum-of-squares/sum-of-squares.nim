# Sum of squares in Nim

proc sumOfSquares(limit: int): int =
    var total = 0
    var number = 1
    while number <= limit:
        total += number * number
        number += 1
    return total

let limit = 10
echo "Sum of squares from 1 to ", limit, ":"
echo sumOfSquares(limit)
