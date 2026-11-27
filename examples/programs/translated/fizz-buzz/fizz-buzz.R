# FizzBuzz in R

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

for (number in 1L:100L) {
    if (ut_integer_remainder(number, 15L) == 0L) {
        cat("FizzBuzz\n", sep = "")
    } else if (ut_integer_remainder(number, 3L) == 0L) {
        cat("Fizz\n", sep = "")
    } else if (ut_integer_remainder(number, 5L) == 0L) {
        cat("Buzz\n", sep = "")
    } else {
        cat(number, "\n", sep = "")
    }
}
