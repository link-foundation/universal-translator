# FizzBuzz in Ruby

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

for number in 1...101
    if ut_integer_remainder(number, 15) == 0
        puts "FizzBuzz"
    elsif ut_integer_remainder(number, 3) == 0
        puts "Fizz"
    elsif ut_integer_remainder(number, 5) == 0
        puts "Buzz"
    else
        puts number
    end
end
