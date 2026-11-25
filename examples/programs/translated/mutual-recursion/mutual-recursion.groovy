// Mutual recursion in Groovy: the Hofstadter Female and Male sequences

long female(long index) {
    if (index == 0) {
        return 1
    }
    return index - male(female(index - 1))
}

long male(long index) {
    if (index == 0) {
        return 0
    }
    return index - female(male(index - 1))
}

for (index in 0..<20) {
    println("${index}: ${female(index)} ${male(index)}")
}
