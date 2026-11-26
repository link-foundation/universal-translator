# Loops/Foreach in R: print every element of a collection

numbers <- c(1L, 1L, 2L, 3L, 5L, 8L, 13L, 21L)
for (number in numbers) {
    cat(number, "\n", sep = "")
}
