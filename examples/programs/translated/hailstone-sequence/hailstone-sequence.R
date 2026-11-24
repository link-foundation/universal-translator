# Hailstone sequence in R: count the steps to reach 1

hailstone_steps <- function(number) {
    steps <- 0L
    while (number != 1L) {
        if (number %% 2L == 0L) {
            number <- number %/% 2L
        } else {
            number <- 3L * number + 1L
        }
        steps <- steps + 1L
    }
    return(steps)
}

for (number in 1L:10L) {
    cat(number, " takes ", hailstone_steps(number), " steps\n", sep = "")
}
