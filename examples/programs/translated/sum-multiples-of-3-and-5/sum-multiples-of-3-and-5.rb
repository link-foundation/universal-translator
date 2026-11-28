# Sum multiples of 3 and 5 in Ruby: the sum of the multiples below 1000

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

total = 0
for number in 1...1000
    if ut_integer_remainder(number, 3) == 0 || ut_integer_remainder(number, 5) == 0
        total += number
    end
end
puts total
