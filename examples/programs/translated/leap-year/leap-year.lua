-- Leap year in Lua

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
