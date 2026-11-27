# Hailstone sequence in Python: count the steps to reach 1

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
