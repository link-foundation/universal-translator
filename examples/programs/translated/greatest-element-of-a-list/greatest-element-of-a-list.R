# Greatest element of a list in R

numbers <- c(17L, 4L, 93L, 28L, 65L, 3L, 80L)
greatest <- numbers[1L]
for (number in numbers) {
    if (number > greatest) {
        greatest <- number
    }
}
cat("The greatest element is ", greatest, "\n", sep = "")
