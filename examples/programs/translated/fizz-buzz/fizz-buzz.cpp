// FizzBuzz in C++

#include <iostream>

int main() {
    for (int number = 1; number < 101; number++) {
        if (number % 15 == 0) {
            std::cout << "FizzBuzz" << std::endl;
        } else if (number % 3 == 0) {
            std::cout << "Fizz" << std::endl;
        } else if (number % 5 == 0) {
            std::cout << "Buzz" << std::endl;
        } else {
            std::cout << number << std::endl;
        }
    }
}
