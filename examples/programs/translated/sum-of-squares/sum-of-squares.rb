# Sum of squares in Ruby

def sum_of_squares(limit)
    total = 0
    number = 1
    while number <= limit
        total += number * number
        number += 1
    end
    return total
end

limit = 10
puts "Sum of squares from 1 to #{limit}:"
puts sum_of_squares(limit)
