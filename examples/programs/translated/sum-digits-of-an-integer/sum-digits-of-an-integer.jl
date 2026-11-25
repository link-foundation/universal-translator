# Sum digits of an integer in Julia

function sum_of_digits(number)
    total = 0
    while number > 0
        total += number % 10
        number = div(number, 10)
    end
    return total
end

function main()
    println("The digits of 1234567890 sum to $(sum_of_digits(1234567890))")
end

main()
