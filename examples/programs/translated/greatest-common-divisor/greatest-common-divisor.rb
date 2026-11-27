# Greatest common divisor in Ruby, using the Euclidean algorithm

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

def greatest_common_divisor(first, second)
    while second != 0
        remainder = ut_integer_remainder(first, second)
        first = second
        second = remainder
    end
    return first
end

puts "The greatest common divisor of 1071 and 462 is #{greatest_common_divisor(1071, 462)}"
