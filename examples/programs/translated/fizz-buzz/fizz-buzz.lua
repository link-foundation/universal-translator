-- FizzBuzz in Lua

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

for number = 1, 100 do
    if ut_integer_remainder(number, 15) == 0 then
        print("FizzBuzz")
    elseif ut_integer_remainder(number, 3) == 0 then
        print("Fizz")
    elseif ut_integer_remainder(number, 5) == 0 then
        print("Buzz")
    else
        print(number)
    end
end
