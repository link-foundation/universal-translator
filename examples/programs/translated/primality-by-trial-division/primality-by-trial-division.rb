# Primality by trial division in Ruby

def is_prime(number)
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

for number in 1...51
    if is_prime(number)
        puts number
    end
end
