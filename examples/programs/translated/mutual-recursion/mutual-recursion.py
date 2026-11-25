# Mutual recursion in Python: the Hofstadter Female and Male sequences

def female(index):
    if index == 0:
        return 1
    return index - male(female(index - 1))

def male(index):
    if index == 0:
        return 0
    return index - female(male(index - 1))

for index in range(20):
    print(f"{index}: {female(index)} {male(index)}")
