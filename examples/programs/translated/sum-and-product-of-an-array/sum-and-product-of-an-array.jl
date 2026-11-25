# Sum and product of an array in Julia

function main()
    numbers = [1, 2, 3, 4, 5]
    total = 0
    product = 1
    for index in 0:length(numbers) - 1
        total += numbers[index + 1]
        product *= numbers[index + 1]
    end
    println("Sum: $(total)")
    println("Product: $(product)")
end

main()
