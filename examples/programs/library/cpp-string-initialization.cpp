#include <iostream>
#include <string>

std::string unused();

int main() {
    std::string greeting(
        "Hello\0hidden"
    );
    std::string suffix;
    if (!suffix.empty()) {
        return 7;
    }
    greeting.append(", world!");
    std::cout << greeting << std::endl;
    return 0;
}
