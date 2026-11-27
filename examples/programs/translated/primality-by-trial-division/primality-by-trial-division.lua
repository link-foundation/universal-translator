-- Primality by trial division in Lua

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
