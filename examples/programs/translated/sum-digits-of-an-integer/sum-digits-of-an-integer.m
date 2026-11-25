/* Sum digits of an integer in Objective-C */

#import <stdio.h>

int sumOfDigits(int number) {
    int total = 0;
    while (number > 0) {
        total += number % 10;
        number /= 10;
    }
    return total;
}

int main(void) {
    printf("The digits of 1234567890 sum to %d\n", sumOfDigits(1234567890));
}
