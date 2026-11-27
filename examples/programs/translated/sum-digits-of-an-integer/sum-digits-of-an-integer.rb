# Sum digits of an integer in Ruby

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

def sum_of_digits(number)
    total = 0
    while number > 0
        total += ut_integer_remainder(number, 10)
        number = ut_integer_divide(number, 10)
    end
    return total
end

puts "The digits of 1234567890 sum to #{sum_of_digits(1234567890)}"
