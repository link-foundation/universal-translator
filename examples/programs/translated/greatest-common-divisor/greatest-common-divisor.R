# Greatest common divisor in R, using the Euclidean algorithm

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

greatest_common_divisor <- function(first, second) {
    while (second != 0L) {
        remainder <- ut_integer_remainder(first, second)
        first <- second
        second <- remainder
    }
    return(first)
}

cat("The greatest common divisor of 1071 and 462 is ", greatest_common_divisor(1071L, 462L), "\n", sep = "")
