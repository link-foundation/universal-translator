-- Sum digits of an integer in Lua

local function sum_of_digits(number)
    local total = 0
    while number > 0 do
        total = total + number % 10
        number = number // 10
    end
    return total
end

print("The digits of 1234567890 sum to " .. sum_of_digits(1234567890))
