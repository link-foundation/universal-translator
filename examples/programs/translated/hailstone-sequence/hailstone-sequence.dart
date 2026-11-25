// Hailstone sequence in Dart: count the steps to reach 1

int hailstoneSteps(int number) {
    var steps = 0;
    while (number != 1) {
        if (number % 2 == 0) {
            number = number ~/ 2;
        } else {
            number = 3 * number + 1;
        }
        steps += 1;
    }
    return steps;
}

void main() {
    for (var number = 1; number < 11; number++) {
        print("${number} takes ${hailstoneSteps(number)} steps");
    }
}
