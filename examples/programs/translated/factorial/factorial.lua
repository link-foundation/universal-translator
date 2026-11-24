-- Factorial in Lua, defined recursively

local function factorial(number)
    if number <= 1 then
        return 1
    end
    return number * factorial(number - 1)
end

for number = 0, 10 do
    print(number .. "! = " .. factorial(number))
end
