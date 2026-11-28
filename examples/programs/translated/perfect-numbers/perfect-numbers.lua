-- Perfect numbers in Lua: numbers equal to the sum of their divisors

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
