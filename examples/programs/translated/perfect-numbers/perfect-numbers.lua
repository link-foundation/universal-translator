-- Perfect numbers in Lua: numbers equal to the sum of their divisors

local function is_perfect(number)
    local sum = 1
    local divisor = 2
    while divisor * divisor <= number do
        if number % divisor == 0 then
            sum = sum + divisor
            if divisor * divisor ~= number then
                sum = sum + number // divisor
            end
        end
        divisor = divisor + 1
    end
    return number > 1 and sum == number
end

for number = 1, 10000 do
    if is_perfect(number) then
        print(number)
    end
end
