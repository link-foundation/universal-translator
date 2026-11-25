// Sum of squares in C++

#include <iostream>

int sum_of_squares(int limit) {
    int total = 0;
    int number = 1;
    while (number <= limit) {
        total += number * number;
        number += 1;
    }
    return total;
}

int main() {
    int limit = 10;
    std::cout << "Sum of squares from 1 to " << limit << ":" << std::endl;
    std::cout << sum_of_squares(limit) << std::endl;
}
