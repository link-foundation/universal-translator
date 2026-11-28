# Primality by trial division in R

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
