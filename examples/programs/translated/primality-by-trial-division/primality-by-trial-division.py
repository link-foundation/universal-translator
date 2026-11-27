# Primality by trial division in Python

def ut_integer_divide(first, second):
    result = first // second
    residue = first - result * second
    if residue != 0:
        if result < 0:
            result += 1
    if result == 0:
        result = 0
    return result

def ut_integer_remainder(first, second):
    result = ut_integer_divide(first, second)
    return first - result * second

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
