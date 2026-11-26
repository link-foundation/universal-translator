// Linear search in Groovy: find the position of a value in a list

List<Long> numbers = [31, 41, 59, 26, 53, 58, 97, 93]
long wanted = 53
long position = -1
long current = 0
for (number in numbers) {
    if (number == wanted && position < 0) {
        position = current
    }
    current += 1
}
println("Found ${wanted} at position ${position}")
