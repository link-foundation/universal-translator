# Fibonacci sequence in Nim, computed iteratively

proc fibonacci(count: int): int =
    var previous = 0
    var current = 1
    for step in 0 ..< count:
        let next = previous + current
        previous = current
        current = next
    return previous

for index in 0 ..< 21:
    echo "fibonacci(", index, ") = ", fibonacci(index)
