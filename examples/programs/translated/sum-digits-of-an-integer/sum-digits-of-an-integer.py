# Sum digits of an integer in Python

def sum_of_digits(number):
    total = 0
    while number > 0:
        total += number % 10
        number = number // 10
    return total

print(f"The digits of 1234567890 sum to {sum_of_digits(1234567890)}")
