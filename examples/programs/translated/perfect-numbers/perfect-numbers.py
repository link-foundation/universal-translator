# Perfect numbers in Python: numbers equal to the sum of their divisors

def is_perfect(number):
    sum = 1
    divisor = 2
    while divisor * divisor <= number:
        if number % divisor == 0:
            sum += divisor
            if divisor * divisor != number:
                sum += number // divisor
        divisor += 1
    return number > 1 and sum == number

for number in range(1, 10001):
    if is_perfect(number):
        print(number)
