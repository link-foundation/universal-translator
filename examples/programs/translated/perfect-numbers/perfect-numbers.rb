# Perfect numbers in Ruby: numbers equal to the sum of their divisors

def is_perfect(number)
    sum = 1
    divisor = 2
    while divisor * divisor <= number
        if number % divisor == 0
            sum += divisor
            if divisor * divisor != number
                sum += number / divisor
            end
        end
        divisor += 1
    end
    return number > 1 && sum == number
end

for number in 1...10001
    if is_perfect(number)
        puts number
    end
end
