# Hailstone sequence in Python: count the steps to reach 1

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

def hailstone_steps(number):
    steps = 0
    while number != 1:
        if ut_integer_remainder(number, 2) == 0:
            number = ut_integer_divide(number, 2)
        else:
            number = 3 * number + 1
        steps += 1
    return steps

for number in range(1, 11):
    print(f"{number} takes {hailstone_steps(number)} steps")
