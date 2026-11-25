def sum_of_squares(limit):
    total = 0
    for i in range(1, limit + 1):
        total += square(i)
    return total

def square(value):
    return value * value
