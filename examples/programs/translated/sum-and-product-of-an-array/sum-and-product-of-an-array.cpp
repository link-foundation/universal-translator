// Sum and product of an array in C++

#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers = {1, 2, 3, 4, 5};
    int total = 0;
    int product = 1;
    for (int index = 0; index < (int) numbers.size(); index++) {
        total += numbers[index];
        product *= numbers[index];
    }
    std::cout << "Sum: " << total << std::endl;
    std::cout << "Product: " << product << std::endl;
}
