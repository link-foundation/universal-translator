# Sum of squares in R

sum_of_squares <- function(limit) {
    total <- 0L
    number <- 1L
    while (number <= limit) {
        total <- total + number * number
        number <- number + 1L
    }
    return(total)
}

limit <- 10L
cat("Sum of squares from 1 to ", limit, ":\n", sep = "")
cat(sum_of_squares(limit), "\n", sep = "")
