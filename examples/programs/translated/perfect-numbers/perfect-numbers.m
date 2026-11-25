/* Perfect numbers in Objective-C: numbers equal to the sum of their divisors */

#import <objc/objc.h>
#import <stdio.h>

BOOL isPerfect(int number) {
    int sum = 1;
    int divisor = 2;
    while (divisor * divisor <= number) {
        if (number % divisor == 0) {
            sum += divisor;
            if (divisor * divisor != number) {
                sum += number / divisor;
            }
        }
        divisor += 1;
    }
    return number > 1 && sum == number;
}

int main(void) {
    for (int number = 1; number < 10001; number++) {
        if (isPerfect(number)) {
            printf("%d\n", number);
        }
    }
}
