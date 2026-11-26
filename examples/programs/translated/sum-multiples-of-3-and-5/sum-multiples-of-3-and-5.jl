# Sum multiples of 3 and 5 in Julia: the sum of the multiples below 1000

function main()
    total = 0
    for number in 1:999
        if number % 3 == 0 || number % 5 == 0
            total += number
        end
    end
    println(total)
end

main()
