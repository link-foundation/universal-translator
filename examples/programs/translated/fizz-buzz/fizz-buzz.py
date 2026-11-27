# FizzBuzz in Python

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

for number in range(1, 101):
    if ut_integer_remainder(number, 15) == 0:
        print("FizzBuzz")
    elif ut_integer_remainder(number, 3) == 0:
        print("Fizz")
    elif ut_integer_remainder(number, 5) == 0:
        print("Buzz")
    else:
        print(number)
