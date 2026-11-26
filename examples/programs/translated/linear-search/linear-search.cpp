// Linear search in C++: find the position of a value in a list

#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers = {31, 41, 59, 26, 53, 58, 97, 93};
    int wanted = 53;
    int position = -1;
    int current = 0;
    for (int number : numbers) {
        if (number == wanted && position < 0) {
            position = current;
        }
        current += 1;
    }
    std::cout << "Found " << wanted << " at position " << position << std::endl;
}
