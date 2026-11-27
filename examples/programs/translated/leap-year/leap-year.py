# Leap year in Python

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

def is_leap_year(year):
    return (ut_integer_remainder(year, 4) == 0 and ut_integer_remainder(year, 100) != 0) or ut_integer_remainder(year, 400) == 0

for year in range(1896, 1913):
    if is_leap_year(year):
        print(f"{year} is a leap year")
    else:
        print(f"{year} is not a leap year")
