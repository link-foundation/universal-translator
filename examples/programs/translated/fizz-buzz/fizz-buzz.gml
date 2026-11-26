// FizzBuzz in GameMaker Language

for (var number = 1; number < 101; number++) {
    if (number % 15 == 0) {
        show_debug_message("FizzBuzz");
    } else if (number % 3 == 0) {
        show_debug_message("Fizz");
    } else if (number % 5 == 0) {
        show_debug_message("Buzz");
    } else {
        show_debug_message(number);
    }
}
