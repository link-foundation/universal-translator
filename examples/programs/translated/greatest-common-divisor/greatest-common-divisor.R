# Greatest common divisor in R, using the Euclidean algorithm

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

greatest_common_divisor <- function(first, second) {
    while (second != 0L) {
        remainder <- ut_integer_remainder(first, second)
        first <- second
        second <- remainder
    }
    return(first)
}

cat("The greatest common divisor of 1071 and 462 is ", greatest_common_divisor(1071L, 462L), "\n", sep = "")
