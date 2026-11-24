# Sum digits of an integer in Nim

proc sumOfDigits(number: int): int =
    var number = number
    var total = 0
    while number > 0:
        total += number mod 10
        number = number div 10
    return total

echo "The digits of 1234567890 sum to ", sumOfDigits(1234567890)
