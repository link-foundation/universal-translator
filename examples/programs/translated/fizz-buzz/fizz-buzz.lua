-- FizzBuzz in Lua

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
