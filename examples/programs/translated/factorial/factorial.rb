# Factorial in Ruby, defined recursively

def factorial(number)
    if number <= 1
        return 1
    end
    return number * factorial(number - 1)
end

for number in 0...11
    puts "#{number}! = #{factorial(number)}"
end
