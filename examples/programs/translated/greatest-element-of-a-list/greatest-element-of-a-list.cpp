// Greatest element of a list in C++

#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers = {17, 4, 93, 28, 65, 3, 80};
    int greatest = numbers[0];
    for (int number : numbers) {
        if (number > greatest) {
            greatest = number;
        }
    }
    std::cout << "The greatest element is " << greatest << std::endl;
}
