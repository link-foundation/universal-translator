-- Greatest common divisor in Lua, using the Euclidean algorithm

local function greatest_common_divisor(first, second)
    while second ~= 0 do
        local remainder = first % second
        first = second
        second = remainder
    end
    return first
end

print("The greatest common divisor of 1071 and 462 is " .. greatest_common_divisor(1071, 462))
