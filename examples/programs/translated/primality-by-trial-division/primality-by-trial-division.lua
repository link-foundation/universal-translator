-- Primality by trial division in Lua

local function is_prime(number)
    if number < 2 then
        return false
    end
    local divisor = 2
    while divisor * divisor <= number do
        if number % divisor == 0 then
            return false
        end
        divisor = divisor + 1
    end
    return true
end

for number = 1, 50 do
    if is_prime(number) then
        print(number)
    end
end
