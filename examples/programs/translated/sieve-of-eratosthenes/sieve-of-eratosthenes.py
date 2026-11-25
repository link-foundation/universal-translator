# Sieve of Eratosthenes in Python: the primes up to 100

limit = 100
is_prime = [1] * (limit + 1)
is_prime[0] = 0
is_prime[1] = 0
for number in range(2, limit + 1):
    if is_prime[number] == 1:
        print(number)
        multiple = number * number
        while multiple <= limit:
            is_prime[multiple] = 0
            multiple += number
