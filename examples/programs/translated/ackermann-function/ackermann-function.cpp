// Ackermann function in C++, defined recursively

#include <iostream>

int ackermann(int first, int second) {
    if (first == 0) {
        return second + 1;
    }
    if (second == 0) {
        return ackermann(first - 1, 1);
    }
    return ackermann(first - 1, ackermann(first, second - 1));
}

int main() {
    for (int first = 0; first < 4; first++) {
        for (int second = 0; second < 5; second++) {
            std::cout << "ackermann(" << first << ", " << second << ") = " << ackermann(first, second) << std::endl;
        }
    }
}
