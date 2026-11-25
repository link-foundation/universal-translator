/* Greatest common divisor in Objective-C, using the Euclidean algorithm */

#import <stdio.h>

int greatestCommonDivisor(int first, int second) {
    while (second != 0) {
        int remainder = first % second;
        first = second;
        second = remainder;
    }
    return first;
}

int main(void) {
    printf("The greatest common divisor of 1071 and 462 is %d\n", greatestCommonDivisor(1071, 462));
}
