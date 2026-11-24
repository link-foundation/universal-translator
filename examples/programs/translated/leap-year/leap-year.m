/* Leap year in Objective-C */

#import <objc/objc.h>
#import <stdio.h>

BOOL isLeapYear(int year) {
    return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
}

int main(void) {
    for (int year = 1896; year < 1913; year++) {
        if (isLeapYear(year)) {
            printf("%d is a leap year\n", year);
        } else {
            printf("%d is not a leap year\n", year);
        }
    }
}
