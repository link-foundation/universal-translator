#include <iostream>
#include <optional>
#include <string>

void report(std::string input, int dimension) {
    std::string copy(input);
    std::optional<int> displaySize(dimension);
    std::cout << copy << ' ' << displaySize.value() << '\n';
}

int main() {
    std::string original = "layout";
    std::string copy(original);
    report(copy, 3);
    return 0;
}
