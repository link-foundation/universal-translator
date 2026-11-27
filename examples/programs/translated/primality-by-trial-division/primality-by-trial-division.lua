-- Primality by trial division in Lua

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

local function is_prime(number)
    if number < 2 then
        return false
    end
    local divisor = 2
    while divisor * divisor <= number do
        if ut_integer_remainder(number, divisor) == 0 then
            return false
        end
        divisor = divisor + 1
    end
    return true
end

for number = 1, 50 do
    if is_prime(number) then
        print(number)
    end
end
