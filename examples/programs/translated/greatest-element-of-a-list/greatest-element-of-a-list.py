# Greatest element of a list in Python

numbers = [17, 4, 93, 28, 65, 3, 80]
greatest = numbers[0]
for number in numbers:
    if number > greatest:
        greatest = number
print(f"The greatest element is {greatest}")
