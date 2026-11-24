# Factorial in R, defined recursively

factorial <- function(number) {
    if (number <= 1L) {
        return(1L)
    }
    return(number * factorial(number - 1L))
}

for (number in 0L:10L) {
    cat(number, "! = ", factorial(number), "\n", sep = "")
}
