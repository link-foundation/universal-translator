# Sum multiples of 3 and 5 in Ruby: the sum of the multiples below 1000

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

total = 0
for number in 1...1000
    if ut_integer_remainder(number, 3) == 0 || ut_integer_remainder(number, 5) == 0
        total += number
    end
end
puts total
