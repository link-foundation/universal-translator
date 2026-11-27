# Primality by trial division in Ruby

def ut_integer_divide(first, second)
    quotient = first / second
    residue = first - quotient * second
    if residue != 0
        if quotient < 0
            quotient += 1
        end
    end
    if quotient == 0
        quotient = 0
    end
    return quotient
end

def ut_integer_remainder(first, second)
    quotient = ut_integer_divide(first, second)
    return first - quotient * second
end

def is_prime(number)
    if number < 2
        return false
    end
    divisor = 2
    while divisor * divisor <= number
        if ut_integer_remainder(number, divisor) == 0
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
