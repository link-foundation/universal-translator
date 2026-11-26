# Sum multiples of 3 and 5 in Python: the sum of the multiples below 1000

total = 0
for number in range(1, 1000):
    if number % 3 == 0 or number % 5 == 0:
        total += number
print(total)
