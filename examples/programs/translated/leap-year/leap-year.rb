# Leap year in Ruby

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

def is_leap_year(year)
    return (ut_integer_remainder(year, 4) == 0 && ut_integer_remainder(year, 100) != 0) || ut_integer_remainder(year, 400) == 0
end

for year in 1896...1913
    if is_leap_year(year)
        puts "#{year} is a leap year"
    else
        puts "#{year} is not a leap year"
    end
end
