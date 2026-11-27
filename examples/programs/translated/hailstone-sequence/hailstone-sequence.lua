-- Hailstone sequence in Lua: count the steps to reach 1

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

local function hailstone_steps(number)
    local steps = 0
    while number ~= 1 do
        if ut_integer_remainder(number, 2) == 0 then
            number = ut_integer_divide(number, 2)
        else
            number = 3 * number + 1
        end
        steps = steps + 1
    end
    return steps
end

for number = 1, 10 do
    print(number .. " takes " .. hailstone_steps(number) .. " steps")
end
