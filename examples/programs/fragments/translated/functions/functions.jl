function sum_of_squares(limit)
    total = 0
    for i in 1:limit
        total += square(i)
    end
    return total
end

function square(value)
    return value * value
end
