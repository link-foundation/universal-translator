-- Leap year in Lua

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

local function is_leap_year(year)
    return (ut_integer_remainder(year, 4) == 0 and ut_integer_remainder(year, 100) ~= 0) or ut_integer_remainder(year, 400) == 0
end

for year = 1896, 1912 do
    if is_leap_year(year) then
        print(year .. " is a leap year")
    else
        print(year .. " is not a leap year")
    end
end
