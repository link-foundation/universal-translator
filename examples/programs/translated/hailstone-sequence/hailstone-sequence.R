# Hailstone sequence in R: count the steps to reach 1

ut_integer_divide <- function(first, second) {
    result <- first %/% second
    residue <- first - result * second
    if (residue != 0L) {
        if (result < 0L) {
            result <- result + 1L
        }
    }
    if (result == 0L) {
        result <- 0L
    }
    return(result)
}

ut_integer_remainder <- function(first, second) {
    result <- ut_integer_divide(first, second)
    return(first - result * second)
}

hailstone_steps <- function(number) {
    steps <- 0L
    while (number != 1L) {
        if (ut_integer_remainder(number, 2L) == 0L) {
            number <- ut_integer_divide(number, 2L)
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
