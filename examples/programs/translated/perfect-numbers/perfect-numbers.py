# Perfect numbers in Python: numbers equal to the sum of their divisors

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

def is_perfect(number):
    sum = 1
    divisor = 2
    while divisor * divisor <= number:
        if ut_integer_remainder(number, divisor) == 0:
            sum += divisor
            if divisor * divisor != number:
                sum += ut_integer_divide(number, divisor)
        divisor += 1
    return number > 1 and sum == number

for number in range(1, 10001):
    if is_perfect(number):
        print(number)
