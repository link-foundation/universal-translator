-- Sum digits of an integer in Lua

local function ut_integer_divide(first, second)
    local result = first // second
    local residue = first - result * second
    if residue ~= 0 then
        if result < 0 then
            result = result + 1
        end
    end
    if result == 0 then
        result = 0
    end
    return result
end

local function ut_integer_remainder(first, second)
    local result = ut_integer_divide(first, second)
    return first - result * second
end

local function sum_of_digits(number)
    local total = 0
    while number > 0 do
        total = total + ut_integer_remainder(number, 10)
        number = ut_integer_divide(number, 10)
    end
    return total
end

print("The digits of 1234567890 sum to " .. sum_of_digits(1234567890))
