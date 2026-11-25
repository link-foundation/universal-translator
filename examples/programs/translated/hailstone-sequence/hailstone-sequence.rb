# Hailstone sequence in Ruby: count the steps to reach 1

def hailstone_steps(number)
    steps = 0
    while number != 1
        if number % 2 == 0
            number /= 2
        else
            number = 3 * number + 1
        end
        steps += 1
    end
    return steps
end

for number in 1...11
    puts "#{number} takes #{hailstone_steps(number)} steps"
end
