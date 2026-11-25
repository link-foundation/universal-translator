# Bubble sort in Julia: sort a list of numbers

function main()
    numbers = [5, 3, 8, 1, 9, 2, 7]
    count = length(numbers)
    for pass in 0:count - 1 - 1
        for index in 0:count - 1 - pass - 1
            if numbers[index + 1] > numbers[index + 2]
                swap = numbers[index + 1]
                numbers[index + 1] = numbers[index + 2]
                numbers[index + 2] = swap
            end
        end
    end
    for position in 0:count - 1
        println(numbers[position + 1])
    end
end

main()
