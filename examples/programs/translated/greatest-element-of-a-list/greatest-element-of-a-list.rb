# Greatest element of a list in Ruby

numbers = [17, 4, 93, 28, 65, 3, 80]
greatest = numbers[0]
for number in numbers
    if number > greatest
        greatest = number
    end
end
puts "The greatest element is #{greatest}"
