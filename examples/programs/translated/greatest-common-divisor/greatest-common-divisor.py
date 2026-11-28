# Greatest common divisor in Python, using the Euclidean algorithm

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

def greatest_common_divisor(first, second):
    while second != 0:
        remainder = ut_integer_remainder(first, second)
        first = second
        second = remainder
    return first

print(f"The greatest common divisor of 1071 and 462 is {greatest_common_divisor(1071, 462)}")
