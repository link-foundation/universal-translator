// Leap year in C++

#include <iostream>

bool is_leap_year(int year) {
    return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
}

int main() {
    for (int year = 1896; year < 1913; year++) {
        if (is_leap_year(year)) {
            std::cout << year << " is a leap year" << std::endl;
        } else {
            std::cout << year << " is not a leap year" << std::endl;
        }
    }
}
