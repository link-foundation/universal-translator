# Sieve of Eratosthenes in Ruby: the primes up to 100

limit = 100
is_prime = Array.new(limit + 1, 1)
is_prime[0] = 0
is_prime[1] = 0
for number in 2...limit + 1
    if is_prime[number] == 1
        puts number
        multiple = number * number
        while multiple <= limit
            is_prime[multiple] = 0
            multiple += number
        end
    end
end
