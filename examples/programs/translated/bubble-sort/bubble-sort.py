# Bubble sort in Python: sort a list of numbers

numbers = [5, 3, 8, 1, 9, 2, 7]
count = len(numbers)
for pass_ in range(count - 1):
    for index in range(count - 1 - pass_):
        if numbers[index] > numbers[index + 1]:
            swap = numbers[index]
            numbers[index] = numbers[index + 1]
            numbers[index + 1] = swap
for position in range(count):
    print(numbers[position])
