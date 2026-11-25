# Fibonacci sequence in R, computed iteratively

fibonacci <- function(count) {
    previous <- 0L
    current <- 1L
    step <- 0L
    while (step < count) {
        next_ <- previous + current
        previous <- current
        current <- next_
        step <- step + 1L
    }
    return(previous)
}

for (index in 0L:20L) {
    cat("fibonacci(", index, ") = ", fibonacci(index), "\n", sep = "")
}
