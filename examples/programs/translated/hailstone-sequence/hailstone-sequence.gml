// Hailstone sequence in GameMaker Language: count the steps to reach 1

function hailstone_steps(number) {
    var steps = 0;
    while (number != 1) {
        if (number % 2 == 0) {
            number = number div 2;
        } else {
            number = 3 * number + 1;
        }
        steps += 1;
    }
    return steps;
}

for (var number = 1; number < 11; number++) {
    show_debug_message($"{number} takes {hailstone_steps(number)} steps");
}
