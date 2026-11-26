// Sum digits of an integer in GameMaker Language

function sum_of_digits(number) {
    var total = 0;
    while (number > 0) {
        total += number % 10;
        number = number div 10;
    }
    return total;
}

show_debug_message($"The digits of 1234567890 sum to {sum_of_digits(1234567890)}");
