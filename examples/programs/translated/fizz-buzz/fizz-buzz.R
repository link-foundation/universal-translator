# FizzBuzz in R

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
