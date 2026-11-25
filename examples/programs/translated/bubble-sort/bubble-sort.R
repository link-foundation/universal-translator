# Bubble sort in R: sort a list of numbers

numbers <- c(5L, 3L, 8L, 1L, 9L, 2L, 7L)
count <- length(numbers)
pass <- 0L
while (pass < count - 1L) {
    index <- 0L
    while (index < count - 1L - pass) {
        if (numbers[index + 1L] > numbers[index + 2L]) {
            swap <- numbers[index + 1L]
            numbers[index + 1L] <- numbers[index + 2L]
            numbers[index + 2L] <- swap
        }
        index <- index + 1L
    }
    pass <- pass + 1L
}
position <- 0L
while (position < count) {
    cat(numbers[position + 1L], "\n", sep = "")
    position <- position + 1L
}
