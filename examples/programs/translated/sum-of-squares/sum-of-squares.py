# Sum of squares in Python

def sum_of_squares(limit):
    total = 0
    number = 1
    while number <= limit:
        total += number * number
        number += 1
    return total

limit = 10
print(f"Sum of squares from 1 to {limit}:")
print(sum_of_squares(limit))
