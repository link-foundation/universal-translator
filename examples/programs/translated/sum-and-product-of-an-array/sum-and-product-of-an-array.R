# Sum and product of an array in R

numbers <- c(1L, 2L, 3L, 4L, 5L)
total <- 0L
product <- 1L
index <- 0L
while (index < length(numbers)) {
    total <- total + numbers[index + 1L]
    product <- product * numbers[index + 1L]
    index <- index + 1L
}
cat("Sum: ", total, "\n", sep = "")
cat("Product: ", product, "\n", sep = "")
