// Leap year in D

import std.stdio;

bool isLeapYear(long year) {
    return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
}

void main() {
    for (long year = 1896; year < 1913; year++) {
        if (isLeapYear(year)) {
            writeln(year, " is a leap year");
        } else {
            writeln(year, " is not a leap year");
        }
    }
}
