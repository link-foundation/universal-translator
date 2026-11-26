-- Sum multiples of 3 and 5 in Lua: the sum of the multiples below 1000

local total = 0
for number = 1, 999 do
    if number % 3 == 0 or number % 5 == 0 then
        total = total + number
    end
end
print(total)
