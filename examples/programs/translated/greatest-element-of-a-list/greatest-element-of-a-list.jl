# Greatest element of a list in Julia

function main()
    numbers = [17, 4, 93, 28, 65, 3, 80]
    greatest = numbers[1]
    for number in numbers
        if number > greatest
            greatest = number
        end
    end
    println("The greatest element is $(greatest)")
end

main()
