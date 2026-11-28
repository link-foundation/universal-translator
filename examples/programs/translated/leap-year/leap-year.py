# Leap year in Python

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

def is_leap_year(year):
    return (ut_integer_remainder(year, 4) == 0 and ut_integer_remainder(year, 100) != 0) or ut_integer_remainder(year, 400) == 0

for year in range(1896, 1913):
    if is_leap_year(year):
        print(f"{year} is a leap year")
    else:
        print(f"{year} is not a leap year")
