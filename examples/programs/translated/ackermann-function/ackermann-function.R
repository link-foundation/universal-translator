# Ackermann function in R, defined recursively

ackermann <- function(first, second) {
    if (first == 0L) {
        return(second + 1L)
    }
    if (second == 0L) {
        return(ackermann(first - 1L, 1L))
    }
    return(ackermann(first - 1L, ackermann(first, second - 1L)))
}

for (first in 0L:3L) {
    for (second in 0L:4L) {
        cat("ackermann(", first, ", ", second, ") = ", ackermann(first, second), "\n", sep = "")
    }
}
