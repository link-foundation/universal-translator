# Ackermann function in Julia, defined recursively

function ackermann(first, second)
    if first == 0
        return second + 1
    end
    if second == 0
        return ackermann(first - 1, 1)
    end
    return ackermann(first - 1, ackermann(first, second - 1))
end

function main()
    for first in 0:3
        for second in 0:4
            println("ackermann($(first), $(second)) = $(ackermann(first, second))")
        end
    end
end

main()
