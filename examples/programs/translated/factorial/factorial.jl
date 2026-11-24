# Factorial in Julia, defined recursively

function factorial(number)
    if number <= 1
        return 1
    end
    return number * factorial(number - 1)
end

function main()
    for number in 0:10
        println("$(number)! = $(factorial(number))")
    end
end

main()
