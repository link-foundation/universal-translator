// Sum of squares in GameMaker Language

function sum_of_squares(limit) {
    var total = 0;
    var number = 1;
    while (number <= limit) {
        total += number * number;
        number += 1;
    }
    return total;
}

var limit = 10;
show_debug_message($"Sum of squares from 1 to {limit}:");
show_debug_message(sum_of_squares(limit));
