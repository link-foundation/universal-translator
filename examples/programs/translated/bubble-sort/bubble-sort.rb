# Bubble sort in Ruby: sort a list of numbers

numbers = [5, 3, 8, 1, 9, 2, 7]
count = numbers.length
for pass in 0...count - 1
    for index in 0...count - 1 - pass
        if numbers[index] > numbers[index + 1]
            swap = numbers[index]
            numbers[index] = numbers[index + 1]
            numbers[index + 1] = swap
        end
    end
end
for position in 0...count
    puts numbers[position]
end
