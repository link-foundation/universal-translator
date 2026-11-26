-- Greatest element of a list in Lua

local numbers = {17, 4, 93, 28, 65, 3, 80}
local greatest = numbers[1]
for _, number in ipairs(numbers) do
    if number > greatest then
        greatest = number
    end
end
print("The greatest element is " .. greatest)
