# Perfect numbers in Nim: numbers equal to the sum of their divisors

proc isPerfect(number: int): bool =
    var sum = 1
    var divisor = 2
    while divisor * divisor <= number:
        if number mod divisor == 0:
            sum += divisor
            if divisor * divisor != number:
                sum += number div divisor
        divisor += 1
    return number > 1 and sum == number

for number in 1 ..< 10001:
    if isPerfect(number):
        echo number
