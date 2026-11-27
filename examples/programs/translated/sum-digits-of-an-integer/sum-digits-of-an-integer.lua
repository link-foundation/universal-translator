-- Sum digits of an integer in Lua

local function ut_integer_divide(first, second)
    local quotient = first // second
    local residue = first - quotient * second
    if residue ~= 0 then
        if quotient < 0 then
            quotient = quotient + 1
        end
    end
    if quotient == 0 then
        quotient = 0
    end
    return quotient
end

local function ut_integer_remainder(first, second)
    local quotient = ut_integer_divide(first, second)
    return first - quotient * second
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
