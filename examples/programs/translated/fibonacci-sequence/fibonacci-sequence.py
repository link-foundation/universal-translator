# Fibonacci sequence in Python, computed iteratively

def fibonacci(count):
    previous = 0
    current = 1
    for step in range(count):
        next = previous + current
        previous = current
        current = next
    return previous

for index in range(21):
    print(f"fibonacci({index}) = {fibonacci(index)}")
