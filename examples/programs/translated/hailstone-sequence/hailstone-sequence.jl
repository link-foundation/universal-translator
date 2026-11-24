# Hailstone sequence in Julia: count the steps to reach 1

function hailstone_steps(number)
    steps = 0
    while number != 1
        if number % 2 == 0
            number = div(number, 2)
        else
            number = 3 * number + 1
        end
        steps += 1
    end
    return steps
end

function main()
    for number in 1:10
        println("$(number) takes $(hailstone_steps(number)) steps")
    end
end

main()
