# Leap year in R

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

is_leap_year <- function(year) {
    return((ut_integer_remainder(year, 4L) == 0L && ut_integer_remainder(year, 100L) != 0L) || ut_integer_remainder(year, 400L) == 0L)
}

for (year in 1896L:1912L) {
    if (is_leap_year(year)) {
        cat(year, " is a leap year\n", sep = "")
    } else {
        cat(year, " is not a leap year\n", sep = "")
    }
}
