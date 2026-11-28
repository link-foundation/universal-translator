# Hailstone sequence in R: count the steps to reach 1

ut_integer_divide <- function(first, second) {
    quotient <- first %/% second
    residue <- first - quotient * second
    if (residue != 0L) {
        if (quotient < 0L) {
            quotient <- quotient + 1L
        }
    }
    if (quotient == 0L) {
        quotient <- 0L
    }
    return(quotient)
}

ut_integer_remainder <- function(first, second) {
    quotient <- ut_integer_divide(first, second)
    return(first - quotient * second)
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
