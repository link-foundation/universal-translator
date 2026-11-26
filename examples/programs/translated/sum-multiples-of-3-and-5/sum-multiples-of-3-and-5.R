# Sum multiples of 3 and 5 in R: the sum of the multiples below 1000

total <- 0L
for (number in 1L:999L) {
    if (number %% 3L == 0L || number %% 5L == 0L) {
        total <- total + number
    }
}
cat(total, "\n", sep = "")
