# Ackermann function in Python, defined recursively

def ackermann(first, second):
    if first == 0:
        return second + 1
    if second == 0:
        return ackermann(first - 1, 1)
    return ackermann(first - 1, ackermann(first, second - 1))

for first in range(4):
    for second in range(5):
        print(f"ackermann({first}, {second}) = {ackermann(first, second)}")
