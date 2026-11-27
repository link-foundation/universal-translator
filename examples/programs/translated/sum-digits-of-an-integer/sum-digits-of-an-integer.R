# Sum digits of an integer in R

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

sum_of_digits <- function(number) {
    total <- 0L
    while (number > 0L) {
        total <- total + ut_integer_remainder(number, 10L)
        number <- ut_integer_divide(number, 10L)
    }
    return(total)
}

cat("The digits of 1234567890 sum to ", sum_of_digits(1234567890L), "\n", sep = "")
