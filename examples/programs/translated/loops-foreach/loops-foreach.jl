# Loops/Foreach in Julia: print every element of a collection

function main()
    numbers = [1, 1, 2, 3, 5, 8, 13, 21]
    for number in numbers
        println(number)
    end
end

main()
