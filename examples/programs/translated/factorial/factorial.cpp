// Factorial in C++, defined recursively

#include <iostream>

int factorial(int number) {
    if (number <= 1) {
        return 1;
    }
    return number * factorial(number - 1);
}

int main() {
    for (int number = 0; number < 11; number++) {
        std::cout << number << "! = " << factorial(number) << std::endl;
    }
}
