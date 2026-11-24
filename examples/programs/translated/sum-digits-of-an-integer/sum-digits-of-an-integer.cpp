// Sum digits of an integer in C++

#include <iostream>

int sum_of_digits(int number) {
    int total = 0;
    while (number > 0) {
        total += number % 10;
        number /= 10;
    }
    return total;
}

int main() {
    std::cout << "The digits of 1234567890 sum to " << sum_of_digits(1234567890) << std::endl;
}
