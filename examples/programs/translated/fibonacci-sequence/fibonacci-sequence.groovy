// Fibonacci sequence in Groovy, computed iteratively

long fibonacci(long count) {
    long previous = 0
    long current = 1
    for (step in 0..<count) {
        long next = previous + current
        previous = current
        current = next
    }
    return previous
}

for (index in 0..<21) {
    println("fibonacci(${index}) = ${fibonacci(index)}")
}
