# Linear search in Python: find the position of a value in a list

numbers = [31, 41, 59, 26, 53, 58, 97, 93]
wanted = 53
position = -1
current = 0
for number in numbers:
    if number == wanted and position < 0:
        position = current
    current += 1
print(f"Found {wanted} at position {position}")
