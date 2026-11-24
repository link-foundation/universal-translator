-- Ackermann function in Lua, defined recursively

local function ackermann(first, second)
    if first == 0 then
        return second + 1
    end
    if second == 0 then
        return ackermann(first - 1, 1)
    end
    return ackermann(first - 1, ackermann(first, second - 1))
end

for first = 0, 3 do
    for second = 0, 4 do
        print("ackermann(" .. first .. ", " .. second .. ") = " .. ackermann(first, second))
    end
end
