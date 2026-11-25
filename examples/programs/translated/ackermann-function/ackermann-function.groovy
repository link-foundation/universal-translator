// Ackermann method in Groovy, defined recursively

long ackermann(long first, long second) {
    if (first == 0) {
        return second + 1
    }
    if (second == 0) {
        return ackermann(first - 1, 1)
    }
    return ackermann(first - 1, ackermann(first, second - 1))
}

for (first in 0..<4) {
    for (second in 0..<5) {
        println("ackermann(${first}, ${second}) = ${ackermann(first, second)}")
    }
}
