# Towers of Hanoi in Python, solved recursively

def move_disks(count, source, target, spare):
    if count == 0:
        return
    move_disks(count - 1, source, spare, target)
    print(f"Move disk {count} from {source} to {target}")
    move_disks(count - 1, spare, target, source)

move_disks(4, 1, 3, 2)
