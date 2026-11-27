# FizzBuzz in Ruby

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
