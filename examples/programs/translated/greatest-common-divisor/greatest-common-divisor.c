/* Greatest common divisor in C, using the Euclidean algorithm */

#include <stdio.h>

int greatest_common_divisor(int first, int second) {
    while (second != 0) {
        int remainder = first % second;
        first = second;
        second = remainder;
    }
    return first;
}

int main(void) {
    printf("The greatest common divisor of 1071 and 462 is %d\n", greatest_common_divisor(1071, 462));
}
