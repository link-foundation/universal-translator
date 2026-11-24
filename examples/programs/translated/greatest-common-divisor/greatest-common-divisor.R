# Greatest common divisor in R, using the Euclidean algorithm

greatest_common_divisor <- function(first, second) {
    while (second != 0L) {
        remainder <- first %% second
        first <- second
        second <- remainder
    }
    return(first)
}

cat("The greatest common divisor of 1071 and 462 is ", greatest_common_divisor(1071L, 462L), "\n", sep = "")
