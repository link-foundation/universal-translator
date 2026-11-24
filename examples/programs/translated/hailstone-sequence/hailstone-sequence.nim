# Hailstone sequence in Nim: count the steps to reach 1

proc hailstoneSteps(number: int): int =
    var number = number
    var steps = 0
    while number != 1:
        if number mod 2 == 0:
            number = number div 2
        else:
            number = 3 * number + 1
        steps += 1
    return steps

for number in 1 ..< 11:
    echo number, " takes ", hailstoneSteps(number), " steps"
