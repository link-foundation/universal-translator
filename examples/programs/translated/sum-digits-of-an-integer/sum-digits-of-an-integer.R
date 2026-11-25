# Sum digits of an integer in R

sum_of_digits <- function(number) {
    total <- 0L
    while (number > 0L) {
        total <- total + number %% 10L
        number <- number %/% 10L
    }
    return(total)
}

cat("The digits of 1234567890 sum to ", sum_of_digits(1234567890L), "\n", sep = "")
