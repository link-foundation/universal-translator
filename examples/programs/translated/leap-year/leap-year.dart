// Leap year in Dart

bool isLeapYear(int year) {
    return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
}

void main() {
    for (var year = 1896; year < 1913; year++) {
        if (isLeapYear(year)) {
            print("${year} is a leap year");
        } else {
            print("${year} is not a leap year");
        }
    }
}
