// Bubble sort in Kotlin: sort a list of numbers

fun main() {
    val numbers = intArrayOf(5, 3, 8, 1, 9, 2, 7)
    val count = numbers.size
    for (pass in 0 until count - 1) {
        for (index in 0 until count - 1 - pass) {
            if (numbers[index] > numbers[index + 1]) {
                val swap = numbers[index]
                numbers[index] = numbers[index + 1]
                numbers[index + 1] = swap
            }
        }
    }
    for (position in 0 until count) {
        println(numbers[position])
    }
}
