-- Greatest common divisor in Lua, using the Euclidean algorithm

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

local function greatest_common_divisor(first, second)
    while second ~= 0 do
        local remainder = ut_integer_remainder(first, second)
        first = second
        second = remainder
    end
    return first
end

print("The greatest common divisor of 1071 and 462 is " .. greatest_common_divisor(1071, 462))
