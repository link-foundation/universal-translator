# FizzBuzz in Julia

function main()
    for number in 1:100
        if number % 15 == 0
            println("FizzBuzz")
        elseif number % 3 == 0
            println("Fizz")
        elseif number % 5 == 0
            println("Buzz")
        else
            println(number)
        end
    end
end

main()
