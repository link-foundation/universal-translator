// Towers of Hanoi in Swift, solved recursively

func moveDisks(_ count: Int, _ source: Int, _ target: Int, _ spare: Int) {
    if count == 0 {
        return
    }
    moveDisks(count - 1, source, spare, target)
    print("Move disk \(count) from \(source) to \(target)")
    moveDisks(count - 1, spare, target, source)
}

moveDisks(4, 1, 3, 2)
