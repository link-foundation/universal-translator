# Primality by trial division in Python

def ut_integer_divide(first, second):
    quotient = first // second
    residue = first - quotient * second
    if residue != 0:
        if quotient < 0:
            quotient += 1
    if quotient == 0:
        quotient = 0
    return quotient

def ut_integer_remainder(first, second):
    quotient = ut_integer_divide(first, second)
    return first - quotient * second

def is_prime(number):
    if number < 2:
        return False
    divisor = 2
    while divisor * divisor <= number:
        if ut_integer_remainder(number, divisor) == 0:
            return False
        divisor += 1
    return True

for number in range(1, 51):
    if is_prime(number):
        print(number)
