-- Towers of Hanoi in Lua, solved recursively

local function move_disks(count, source, target, spare)
    if count == 0 then
        return
    end
    move_disks(count - 1, source, spare, target)
    print("Move disk " .. count .. " from " .. source .. " to " .. target)
    move_disks(count - 1, spare, target, source)
end

move_disks(4, 1, 3, 2)
