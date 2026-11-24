-- Fibonacci sequence in Lua, computed iteratively

local function fibonacci(count)
    local previous = 0
    local current = 1
    for step = 0, count - 1 do
        local next = previous + current
        previous = current
        current = next
    end
    return previous
end

for index = 0, 20 do
    print("fibonacci(" .. index .. ") = " .. fibonacci(index))
end
