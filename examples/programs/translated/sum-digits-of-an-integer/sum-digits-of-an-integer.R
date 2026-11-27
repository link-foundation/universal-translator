# Sum digits of an integer in R

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

sum_of_digits <- function(number) {
    total <- 0L
    while (number > 0L) {
        total <- total + ut_integer_remainder(number, 10L)
        number <- ut_integer_divide(number, 10L)
    }
    return(total)
}

cat("The digits of 1234567890 sum to ", sum_of_digits(1234567890L), "\n", sep = "")
