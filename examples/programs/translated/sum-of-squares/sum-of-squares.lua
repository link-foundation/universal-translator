-- Sum of squares in Lua

local function sum_of_squares(limit)
    local total = 0
    local number = 1
    while number <= limit do
        total = total + number * number
        number = number + 1
    end
    return total
end

local limit = 10
print("Sum of squares from 1 to " .. limit .. ":")
print(sum_of_squares(limit))
