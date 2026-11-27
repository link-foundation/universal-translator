-- Hailstone sequence in Lua: count the steps to reach 1

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
