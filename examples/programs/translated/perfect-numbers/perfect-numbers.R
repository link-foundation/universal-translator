# Perfect numbers in R: numbers equal to the sum of their divisors

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

is_perfect <- function(number) {
    sum <- 1L
    divisor <- 2L
    while (divisor * divisor <= number) {
        if (ut_integer_remainder(number, divisor) == 0L) {
            sum <- sum + divisor
            if (divisor * divisor != number) {
                sum <- sum + ut_integer_divide(number, divisor)
            }
        }
        divisor <- divisor + 1L
    }
    return(number > 1L && sum == number)
}

for (number in 1L:10000L) {
    if (is_perfect(number)) {
        cat(number, "\n", sep = "")
    }
}
