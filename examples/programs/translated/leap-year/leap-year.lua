-- Leap year in Lua

local function is_leap_year(year)
    return (year % 4 == 0 and year % 100 ~= 0) or year % 400 == 0
end

for year = 1896, 1912 do
    if is_leap_year(year) then
        print(year .. " is a leap year")
    else
        print(year .. " is not a leap year")
    end
end
