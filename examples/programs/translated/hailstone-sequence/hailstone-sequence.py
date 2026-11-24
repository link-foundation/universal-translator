# Hailstone sequence in Python: count the steps to reach 1

def hailstone_steps(number):
    steps = 0
    while number != 1:
        if number % 2 == 0:
            number = number // 2
        else:
            number = 3 * number + 1
        steps += 1
    return steps

for number in range(1, 11):
    print(f"{number} takes {hailstone_steps(number)} steps")
