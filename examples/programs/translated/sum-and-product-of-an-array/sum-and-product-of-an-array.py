# Sum and product of an array in Python

numbers = [1, 2, 3, 4, 5]
total = 0
product = 1
for index in range(len(numbers)):
    total += numbers[index]
    product *= numbers[index]
print(f"Sum: {total}")
print(f"Product: {product}")
