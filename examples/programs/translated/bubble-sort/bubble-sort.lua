-- Bubble sort in Lua: sort a list of numbers

local numbers = {5, 3, 8, 1, 9, 2, 7}
local count = #numbers
for pass = 0, count - 1 - 1 do
    for index = 0, count - 1 - pass - 1 do
        if numbers[index + 1] > numbers[index + 2] then
            local swap = numbers[index + 1]
            numbers[index + 1] = numbers[index + 2]
            numbers[index + 2] = swap
        end
    end
end
for position = 0, count - 1 do
    print(numbers[position + 1])
end
