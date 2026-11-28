# Compare both quotient conventions with native runtimes.
def first():
    print(101)
    return -7

def second():
    print(101)
    return 3

print((-7) // (3))
print((-7) % (3))
print((7) // (-3))
print((7) % (-3))
print((-7) // (-3))
print((-7) % (-3))
print((7) // (3))
print((7) % (3))
print((-6) // (3))
print((-6) % (3))
print((6) // (-3))
print((6) % (-3))
print((-6) // (-3))
print((-6) % (-3))
print((0) // (3))
print((0) % (3))
print((0) // (-3))
print((0) % (-3))
print((-1) // (3))
print((-1) % (3))
print((1) // (-3))
print((1) % (-3))
print((-1) // (-3))
print((-1) % (-3))
print(first() // second())
print(first() % second())
value = -7
value //= 3
print(value)
value %= 2
print(value)
