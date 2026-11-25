sum_of_squares <- function(limit) {
    total <- 0L
    i <- 1L
    while (i < limit + 1L) {
        total <- total + square(i)
        i <- i + 1L
    }
    return(total)
}

square <- function(value) {
    return(value * value)
}
