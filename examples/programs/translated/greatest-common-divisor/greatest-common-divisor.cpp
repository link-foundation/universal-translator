// Greatest common divisor in C++, using the Euclidean algorithm

#include <iostream>

int greatest_common_divisor(int first, int second) {
    while (second != 0) {
        int remainder = first % second;
        first = second;
        second = remainder;
    }
    return first;
}

int main() {
    std::cout << "The greatest common divisor of 1071 and 462 is " << greatest_common_divisor(1071, 462) << std::endl;
}
