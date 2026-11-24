// Fibonacci sequence in C++, computed iteratively

#include <iostream>

int fibonacci(int count) {
    int previous = 0;
    int current = 1;
    for (int step = 0; step < count; step++) {
        int next = previous + current;
        previous = current;
        current = next;
    }
    return previous;
}

int main() {
    for (int index = 0; index < 21; index++) {
        std::cout << "fibonacci(" << index << ") = " << fibonacci(index) << std::endl;
    }
}
