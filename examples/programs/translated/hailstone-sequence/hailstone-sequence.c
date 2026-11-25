/* Hailstone sequence in C: count the steps to reach 1 */

#include <stdio.h>

int hailstone_steps(int number) {
    int steps = 0;
    while (number != 1) {
        if (number % 2 == 0) {
            number /= 2;
        } else {
            number = 3 * number + 1;
        }
        steps += 1;
    }
    return steps;
}

int main(void) {
    for (int number = 1; number < 11; number++) {
        printf("%d takes %d steps\n", number, hailstone_steps(number));
    }
}
