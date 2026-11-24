-- Hailstone sequence in Lua: count the steps to reach 1

local function hailstone_steps(number)
    local steps = 0
    while number ~= 1 do
        if number % 2 == 0 then
            number = number // 2
        else
            number = 3 * number + 1
        end
        steps = steps + 1
    end
    return steps
end

for number = 1, 10 do
    print(number .. " takes " .. hailstone_steps(number) .. " steps")
end
