# Factorial in Python, defined recursively

def factorial(number):
    if number <= 1:
        return 1
    return number * factorial(number - 1)

for number in range(11):
    print(f"{number}! = {factorial(number)}")
