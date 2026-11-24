# Towers of Hanoi in Nim, solved recursively

proc moveDisks(count: int, source: int, target: int, spare: int) =
    if count == 0:
        return
    moveDisks(count - 1, source, spare, target)
    echo "Move disk ", count, " from ", source, " to ", target
    moveDisks(count - 1, spare, target, source)

moveDisks(4, 1, 3, 2)
