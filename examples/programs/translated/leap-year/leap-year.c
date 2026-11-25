/* Leap year in C */

#include <stdbool.h>
#include <stdio.h>

bool is_leap_year(int year) {
    return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
}

int main(void) {
    for (int year = 1896; year < 1913; year++) {
        if (is_leap_year(year)) {
            printf("%d is a leap year\n", year);
        } else {
            printf("%d is not a leap year\n", year);
        }
    }
}
