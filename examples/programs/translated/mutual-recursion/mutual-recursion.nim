# Mutual recursion in Nim: the Hofstadter Female and Male sequences

proc male(index: int): int

proc female(index: int): int =
    if index == 0:
        return 1
    return index - male(female(index - 1))

proc male(index: int): int =
    if index == 0:
        return 0
    return index - female(male(index - 1))

for index in 0 ..< 20:
    echo index, ": ", female(index), " ", male(index)
