/* Sum digits of an integer in C */

#include <stdio.h>

int sum_of_digits(int number) {
    int total = 0;
    while (number > 0) {
        total += number % 10;
        number /= 10;
    }
    return total;
}

int main(void) {
    printf("The digits of 1234567890 sum to %d\n", sum_of_digits(1234567890));
}
