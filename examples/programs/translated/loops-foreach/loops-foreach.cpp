// Loops/Foreach in C++: print every element of a collection

#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers = {1, 1, 2, 3, 5, 8, 13, 21};
    for (int number : numbers) {
        std::cout << number << std::endl;
    }
}
