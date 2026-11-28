#include <iostream>
#include <stdexcept>
#include <string>

int main() {
    std::string label;
    int count = 0;
    std::cin >> label >> count;
    try {
        if (count == 0) {
            throw std::invalid_argument(label);
        }
        std::cout << label << ' ' << count << '\n';
    } catch (const std::invalid_argument& error) {
        std::cout << error.what() << '\n';
    }
    return 0;
}
