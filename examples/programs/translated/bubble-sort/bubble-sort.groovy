// Bubble sort in Groovy: sort a list of numbers

List<Long> numbers = [5, 3, 8, 1, 9, 2, 7]
long count = numbers.size()
for (pass in 0..<count - 1) {
    for (index in 0..<count - 1 - pass) {
        if (numbers[index] > numbers[index + 1]) {
            long swap = numbers[index]
            numbers[index] = numbers[index + 1]
            numbers[index + 1] = swap
        }
    }
}
for (position in 0..<count) {
    println(numbers[position])
}
