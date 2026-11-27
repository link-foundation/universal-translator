# FizzBuzz in Python

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

for number in range(1, 101):
    if ut_integer_remainder(number, 15) == 0:
        print("FizzBuzz")
    elif ut_integer_remainder(number, 3) == 0:
        print("Fizz")
    elif ut_integer_remainder(number, 5) == 0:
        print("Buzz")
    else:
        print(number)
