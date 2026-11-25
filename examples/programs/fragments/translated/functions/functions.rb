def sum_of_squares(limit)
    total = 0
    for i in 1...limit + 1
        total += square(i)
    end
    return total
end

def square(value)
    return value * value
end
