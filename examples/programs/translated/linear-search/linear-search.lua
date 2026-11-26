-- Linear search in Lua: find the position of a value in a list

local numbers = {31, 41, 59, 26, 53, 58, 97, 93}
local wanted = 53
local position = -1
local current = 0
for _, number in ipairs(numbers) do
    if number == wanted and position < 0 then
        position = current
    end
    current = current + 1
end
print("Found " .. wanted .. " at position " .. position)
