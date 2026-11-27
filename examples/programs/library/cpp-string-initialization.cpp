#include <iostream>
#include <string>

std::string unused();

int main() {
    std::string greeting(
        "Hello\0hidden"
    );
    greeting.append(", world!");
    std::cout << greeting << std::endl;
    return 0;
}
