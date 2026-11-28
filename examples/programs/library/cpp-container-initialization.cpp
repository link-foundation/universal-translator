#include <iostream>
#include <optional>

int main() {
    std::optional<std::optional<unsigned>> empty;
    std::optional<unsigned> count = 7;
    if (empty.has_value()) {
        std::cout << 1 << std::endl;
    } else {
        std::cout << 0 << std::endl;
    }
    if (count.has_value()) {
        std::cout << count.value() << std::endl;
    }
    return 0;
}
