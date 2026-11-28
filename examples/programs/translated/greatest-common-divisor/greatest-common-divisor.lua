-- Greatest common divisor in Lua, using the Euclidean algorithm

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

local function greatest_common_divisor(first, second)
    while second ~= 0 do
        local remainder = ut_integer_remainder(first, second)
        first = second
        second = remainder
    end
    return first
end

print("The greatest common divisor of 1071 and 462 is " .. greatest_common_divisor(1071, 462))
