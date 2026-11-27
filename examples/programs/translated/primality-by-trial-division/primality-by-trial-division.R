# Primality by trial division in R

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

is_prime <- function(number) {
    if (number < 2L) {
        return(FALSE)
    }
    divisor <- 2L
    while (divisor * divisor <= number) {
        if (ut_integer_remainder(number, divisor) == 0L) {
            return(FALSE)
        }
        divisor <- divisor + 1L
    }
    return(TRUE)
}

for (number in 1L:50L) {
    if (is_prime(number)) {
        cat(number, "\n", sep = "")
    }
}
