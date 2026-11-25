local square

local function sum_of_squares(limit)
    local total = 0
    for i = 1, limit do
        total = total + square(i)
    end
    return total
end

function square(value)
    return value * value
end
