# Sum multiples of 3 and 5 in Ruby: the sum of the multiples below 1000

total = 0
for number in 1...1000
    if number % 3 == 0 || number % 5 == 0
        total += number
    end
end
puts total
