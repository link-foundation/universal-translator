# Linear search in R: find the position of a value in a list

numbers <- c(31L, 41L, 59L, 26L, 53L, 58L, 97L, 93L)
wanted <- 53L
position <- -1L
current <- 0L
for (number in numbers) {
    if (number == wanted && position < 0L) {
        position <- current
    }
    current <- current + 1L
}
cat("Found ", wanted, " at position ", position, "\n", sep = "")
