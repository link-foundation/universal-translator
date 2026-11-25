# Perfect numbers in Julia: numbers equal to the sum of their divisors

function is_perfect(number)
    sum = 1
    divisor = 2
    while divisor * divisor <= number
        if number % divisor == 0
            sum += divisor
            if divisor * divisor != number
                sum += div(number, divisor)
            end
        end
        divisor += 1
    end
    return number > 1 && sum == number
end

function main()
    for number in 1:10000
        if is_perfect(number)
            println(number)
        end
    end
end

main()
