// FizzBuzz in Kotlin

fun main() {
    for (number in 1 until 101) {
        if (number % 15 == 0) {
            println("FizzBuzz")
        } else if (number % 3 == 0) {
            println("Fizz")
        } else if (number % 5 == 0) {
            println("Buzz")
        } else {
            println(number)
        }
    }
}
