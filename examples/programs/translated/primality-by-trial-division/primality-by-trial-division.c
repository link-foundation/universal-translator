/* Primality by trial division in C */

#include <stdbool.h>
#include <stdio.h>

bool is_prime(int number) {
    if (number < 2) {
        return false;
    }
    int divisor = 2;
    while (divisor * divisor <= number) {
        if (number % divisor == 0) {
            return false;
        }
        divisor += 1;
    }
    return true;
}

int main(void) {
    for (int number = 1; number < 51; number++) {
        if (is_prime(number)) {
            printf("%d\n", number);
        }
    }
}
