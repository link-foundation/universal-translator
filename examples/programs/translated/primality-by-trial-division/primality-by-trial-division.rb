# Primality by trial division in Ruby

def ut_integer_divide(first, second)
    result = first / second
    residue = first - result * second
    if residue != 0
        if result < 0
            result += 1
        end
    end
    if result == 0
        result = 0
    end
    return result
end

def ut_integer_remainder(first, second)
    result = ut_integer_divide(first, second)
    return first - result * second
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
