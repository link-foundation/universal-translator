-- Sum multiples of 3 and 5 in Lua: the sum of the multiples below 1000

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

local total = 0
for number = 1, 999 do
    if ut_integer_remainder(number, 3) == 0 or ut_integer_remainder(number, 5) == 0 then
        total = total + number
    end
end
print(total)
