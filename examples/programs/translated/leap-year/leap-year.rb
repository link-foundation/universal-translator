# Leap year in Ruby

def is_leap_year(year)
    return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
end

for year in 1896...1913
    if is_leap_year(year)
        puts "#{year} is a leap year"
    else
        puts "#{year} is not a leap year"
    end
end
