# Factorial in Nim, defined recursively

proc factorial(number: int): int =
    if number <= 1:
        return 1
    return number * factorial(number - 1)

for number in 0 ..< 11:
    echo number, "! = ", factorial(number)
