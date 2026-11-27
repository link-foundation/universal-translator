def first():
    print(101)
    return -7

def second():
    print(202)
    return 3

def combine(left, right):
    return left - right

print(first() // second())
print(first() % second())
print(combine(first(), second()))
print(first() - second())
count = 0
while first() // second() < -2 and count < 2:
    count += 1
print(count)
if 1 < 0 and first() // second() < 0:
    print(999)
