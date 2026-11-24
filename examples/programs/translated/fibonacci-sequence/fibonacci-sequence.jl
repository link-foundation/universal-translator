# Fibonacci sequence in Julia, computed iteratively

function fibonacci(count)
    previous = 0
    current = 1
    for step in 0:count - 1
        next = previous + current
        previous = current
        current = next
    end
    return previous
end

function main()
    for index in 0:20
        println("fibonacci($(index)) = $(fibonacci(index))")
    end
end

main()
