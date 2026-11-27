-- Perfect numbers in Lua: numbers equal to the sum of their divisors

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

local function is_perfect(number)
    local sum = 1
    local divisor = 2
    while divisor * divisor <= number do
        if ut_integer_remainder(number, divisor) == 0 then
            sum = sum + divisor
            if divisor * divisor ~= number then
                sum = sum + ut_integer_divide(number, divisor)
            end
        end
        divisor = divisor + 1
    end
    return number > 1 and sum == number
end

for number = 1, 10000 do
    if is_perfect(number) then
        print(number)
    end
end
