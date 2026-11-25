# Sieve of Eratosthenes in Julia: the primes up to 100

function main()
    limit = 100
    is_prime = fill(1, limit + 1)
    is_prime[1] = 0
    is_prime[2] = 0
    for number in 2:limit
        if is_prime[number + 1] == 1
            println(number)
            multiple = number * number
            while multiple <= limit
                is_prime[multiple + 1] = 0
                multiple += number
            end
        end
    end
end

main()
