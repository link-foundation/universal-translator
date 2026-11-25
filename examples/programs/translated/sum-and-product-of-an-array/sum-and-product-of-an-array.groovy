// Sum and product of an array in Groovy

List<Long> numbers = [1, 2, 3, 4, 5]
long total = 0
long product = 1
for (index in 0..<numbers.size()) {
    total += numbers[index]
    product *= numbers[index]
}
println("Sum: ${total}")
println("Product: ${product}")
