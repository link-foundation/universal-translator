# Sum and product of an array in Ruby

numbers = [1, 2, 3, 4, 5]
total = 0
product = 1
for index in 0...numbers.length
    total += numbers[index]
    product *= numbers[index]
end
puts "Sum: #{total}"
puts "Product: #{product}"
