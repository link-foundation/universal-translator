// Towers of Hanoi in Kotlin, solved recursively

fun moveDisks(count: Int, source: Int, target: Int, spare: Int) {
    if (count == 0) {
        return
    }
    moveDisks(count - 1, source, spare, target)
    println("Move disk ${count} from ${source} to ${target}")
    moveDisks(count - 1, spare, target, source)
}

fun main() {
    moveDisks(4, 1, 3, 2)
}
