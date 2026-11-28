-- Sum multiples of 3 and 5 in Lua: the sum of the multiples below 1000

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

local total = 0
for number = 1, 999 do
    if ut_integer_remainder(number, 3) == 0 or ut_integer_remainder(number, 5) == 0 then
        total = total + number
    end
end
print(total)
