-- 99 bottles of beer in Lua

local bottles = 99
while bottles > 0 do
    print(bottles .. " bottles of beer on the wall, " .. bottles .. " bottles of beer.")
    print("Take one down and pass it around, " .. (bottles - 1) .. " bottles of beer on the wall.")
    bottles = bottles - 1
end
