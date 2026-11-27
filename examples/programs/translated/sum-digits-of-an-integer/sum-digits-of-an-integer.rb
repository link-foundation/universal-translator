# Sum digits of an integer in Ruby

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

def sum_of_digits(number)
    total = 0
    while number > 0
        total += ut_integer_remainder(number, 10)
        number = ut_integer_divide(number, 10)
    end
    return total
end

puts "The digits of 1234567890 sum to #{sum_of_digits(1234567890)}"
