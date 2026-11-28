# Sum multiples of 3 and 5 in R: the sum of the multiples below 1000

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

total <- 0L
for (number in 1L:999L) {
    if (ut_integer_remainder(number, 3L) == 0L || ut_integer_remainder(number, 5L) == 0L) {
        total <- total + number
    }
}
cat(total, "\n", sep = "")
