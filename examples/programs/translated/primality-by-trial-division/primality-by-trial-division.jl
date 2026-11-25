# Primality by trial division in Julia

function is_prime(number)
    if number < 2
        return false
    end
    divisor = 2
    while divisor * divisor <= number
        if number % divisor == 0
            return false
        end
        divisor += 1
    end
    return true
end

function main()
    for number in 1:50
        if is_prime(number)
            println(number)
        end
    end
end

main()
