/* Factorial in Objective-C, defined recursively */

#import <stdio.h>

int factorial(int number) {
    if (number <= 1) {
        return 1;
    }
    return number * factorial(number - 1);
}

int main(void) {
    for (int number = 0; number < 11; number++) {
        printf("%d! = %d\n", number, factorial(number));
    }
}
