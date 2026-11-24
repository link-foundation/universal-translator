# Perfect numbers in R: numbers equal to the sum of their divisors

is_perfect <- function(number) {
    sum <- 1L
    divisor <- 2L
    while (divisor * divisor <= number) {
        if (number %% divisor == 0L) {
            sum <- sum + divisor
            if (divisor * divisor != number) {
                sum <- sum + number %/% divisor
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
