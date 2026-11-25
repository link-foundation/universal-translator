# Fibonacci sequence in Ruby, computed iteratively

def fibonacci(count)
    previous = 0
    current = 1
    for step in 0...count
        next_ = previous + current
        previous = current
        current = next_
    end
    return previous
end

for index in 0...21
    puts "fibonacci(#{index}) = #{fibonacci(index)}"
end
