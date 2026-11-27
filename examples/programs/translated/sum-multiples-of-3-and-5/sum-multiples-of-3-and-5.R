# Sum multiples of 3 and 5 in R: the sum of the multiples below 1000

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

total <- 0L
for (number in 1L:999L) {
    if (ut_integer_remainder(number, 3L) == 0L || ut_integer_remainder(number, 5L) == 0L) {
        total <- total + number
    }
}
cat(total, "\n", sep = "")
