# Primality by trial division in Nim

proc isPrime(number: int): bool =
    if number < 2:
        return false
    var divisor = 2
    while divisor * divisor <= number:
        if number mod divisor == 0:
            return false
        divisor += 1
    return true

for number in 1 ..< 51:
    if isPrime(number):
        echo number
