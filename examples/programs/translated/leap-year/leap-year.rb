# Leap year in Ruby

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
