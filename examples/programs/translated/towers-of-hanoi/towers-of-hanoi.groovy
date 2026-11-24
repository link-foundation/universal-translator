// Towers of Hanoi in Groovy, solved recursively

void moveDisks(long count, long source, long target, long spare) {
    if (count == 0) {
        return
    }
    moveDisks(count - 1, source, spare, target)
    println("Move disk ${count} from ${source} to ${target}")
    moveDisks(count - 1, spare, target, source)
}

moveDisks(4, 1, 3, 2)
