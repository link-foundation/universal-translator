-- Sieve of Eratosthenes in Lua: the primes up to 100

local limit = 100
local is_prime = {}
for index = 0, limit do
    is_prime[index + 1] = 1
end
is_prime[1] = 0
is_prime[2] = 0
for number = 2, limit do
    if is_prime[number + 1] == 1 then
        print(number)
        local multiple = number * number
        while multiple <= limit do
            is_prime[multiple + 1] = 0
            multiple = multiple + number
        end
    end
end
