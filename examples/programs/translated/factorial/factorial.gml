// Factorial in GameMaker Language, defined recursively

function factorial(number) {
    if (number <= 1) {
        return 1;
    }
    return number * factorial(number - 1);
}

for (var number = 0; number < 11; number++) {
    show_debug_message($"{number}! = {factorial(number)}");
}
