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
    std::string repeated(3, '\0');
    if (repeated.size() != 3 || repeated[1] != '\0') {
        return 8;
    }
    greeting.append(", world!");
    std::cout << greeting << std::endl;
    return 0;
}
