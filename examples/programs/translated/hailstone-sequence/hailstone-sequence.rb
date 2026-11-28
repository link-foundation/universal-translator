# Hailstone sequence in Ruby: count the steps to reach 1

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

def hailstone_steps(number)
    steps = 0
    while number != 1
        if ut_integer_remainder(number, 2) == 0
            number = ut_integer_divide(number, 2)
        else
            number = 3 * number + 1
        end
        steps += 1
    end
    return steps
end

for number in 1...11
    puts "#{number} takes #{hailstone_steps(number)} steps"
end
