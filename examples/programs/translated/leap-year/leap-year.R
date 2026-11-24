# Leap year in R

is_leap_year <- function(year) {
    return((year %% 4L == 0L && year %% 100L != 0L) || year %% 400L == 0L)
}

for (year in 1896L:1912L) {
    if (is_leap_year(year)) {
        cat(year, " is a leap year\n", sep = "")
    } else {
        cat(year, " is not a leap year\n", sep = "")
    }
}
