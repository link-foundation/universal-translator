# Sum of squares in Julia

function sum_of_squares(limit)
    total = 0
    number = 1
    while number <= limit
        total += number * number
        number += 1
    end
    return total
end

function main()
    limit = 10
    println("Sum of squares from 1 to $(limit):")
    println(sum_of_squares(limit))
end

main()
