-- Loops/Foreach in Lua: print every element of a collection

local numbers = {1, 1, 2, 3, 5, 8, 13, 21}
for _, number in ipairs(numbers) do
    print(number)
end
