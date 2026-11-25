proc square(value: int): int

proc sumOfSquares(limit: int): int =
    var total = 0
    for i in 1 ..< limit + 1:
        total += square(i)
    return total

proc square(value: int): int =
    return value * value
