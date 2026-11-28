# Perfect numbers in Ruby: numbers equal to the sum of their divisors

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

def is_perfect(number)
    sum = 1
    divisor = 2
    while divisor * divisor <= number
        if ut_integer_remainder(number, divisor) == 0
            sum += divisor
            if divisor * divisor != number
                sum += ut_integer_divide(number, divisor)
            end
        end
        divisor += 1
    end
    return number > 1 && sum == number
end

for number in 1...10001
    if is_perfect(number)
        puts number
    end
end
