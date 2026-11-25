# FizzBuzz in R

for (number in 1L:100L) {
    if (number %% 15L == 0L) {
        cat("FizzBuzz\n", sep = "")
    } else if (number %% 3L == 0L) {
        cat("Fizz\n", sep = "")
    } else if (number %% 5L == 0L) {
        cat("Buzz\n", sep = "")
    } else {
        cat(number, "\n", sep = "")
    }
}
