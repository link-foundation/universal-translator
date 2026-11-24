# Towers of Hanoi in Julia, solved recursively

function move_disks(count, source, target, spare)
    if count == 0
        return
    end
    move_disks(count - 1, source, spare, target)
    println("Move disk $(count) from $(source) to $(target)")
    move_disks(count - 1, spare, target, source)
end

function main()
    move_disks(4, 1, 3, 2)
end

main()
