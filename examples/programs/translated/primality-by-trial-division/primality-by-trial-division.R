# Primality by trial division in R

is_prime <- function(number) {
    if (number < 2L) {
        return(FALSE)
    }
    divisor <- 2L
    while (divisor * divisor <= number) {
        if (number %% divisor == 0L) {
            return(FALSE)
        }
        divisor <- divisor + 1L
    }
    return(TRUE)
}

for (number in 1L:50L) {
    if (is_prime(number)) {
        cat(number, "\n", sep = "")
    }
}
