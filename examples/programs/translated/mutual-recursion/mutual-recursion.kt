// Mutual recursion in Kotlin: the Hofstadter Female and Male sequences

fun female(index: Int): Int {
    if (index == 0) {
        return 1
    }
    return index - male(female(index - 1))
}

fun male(index: Int): Int {
    if (index == 0) {
        return 0
    }
    return index - female(male(index - 1))
}

fun main() {
    for (index in 0 until 20) {
        println("${index}: ${female(index)} ${male(index)}")
    }
}
