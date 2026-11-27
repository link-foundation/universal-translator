#include <array>
#include <iostream>
#include <string>

int main() {
    const std::array<std::string, 3> fallFruit {"pear", "apple",};
    std::array<std::array<int, 2>, 2> numbers = {{{1, 2}, {3, 4}}};
    std::array<int, 0> empty {};
    std::cout << fallFruit.size() << " " << fallFruit[1] << "[" << fallFruit[2] << "] ";
    std::cout << numbers.size() << " " << numbers.at(1).at(0);
    std::cout << " " << empty.size() << std::endl;
}
