/* Primality by trial division in Objective-C */

#ifdef __PORTABLE_OBJC__
#include <objcrt.h>
#else
#import <objc/objc.h>
#endif
#import <stdio.h>

BOOL isPrime(int number) {
    if (number < 2) {
        return NO;
    }
    int divisor = 2;
    while (divisor * divisor <= number) {
        if (number % divisor == 0) {
            return NO;
        }
        divisor += 1;
    }
    return YES;
}

int main(void) {
    for (int number = 1; number < 51; number++) {
        if (isPrime(number)) {
            printf("%d\n", number);
        }
    }
    return 0;
}
