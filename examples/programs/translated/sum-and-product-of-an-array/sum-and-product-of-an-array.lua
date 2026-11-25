-- Sum and product of an array in Lua

local numbers = {1, 2, 3, 4, 5}
local total = 0
local product = 1
for index = 0, #numbers - 1 do
    total = total + numbers[index + 1]
    product = product * numbers[index + 1]
end
print("Sum: " .. total)
print("Product: " .. product)
