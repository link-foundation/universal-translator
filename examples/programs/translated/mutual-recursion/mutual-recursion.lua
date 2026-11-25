-- Mutual recursion in Lua: the Hofstadter Female and Male sequences

local male

local function female(index)
    if index == 0 then
        return 1
    end
    return index - male(female(index - 1))
end

function male(index)
    if index == 0 then
        return 0
    end
    return index - female(male(index - 1))
end

for index = 0, 19 do
    print(index .. ": " .. female(index) .. " " .. male(index))
end
