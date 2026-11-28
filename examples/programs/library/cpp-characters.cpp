#include <iostream>
#include <string>

std::string decorate(const std::string& prefix, std::string word) {
    return prefix[0] + word + '!';
}

int main() {
    std::cout << (int)'a' << std::endl;
    std::cout << (char)97 << std::endl;
    std::cout << '\x41' << '\\' << '\'' << '\n';
    std::cout << (int)(char)(64 + 1) << std::endl;
    std::cout << sizeof(char) << " " << sizeof('a') << std::endl;
    std::cout << decorate("ax", "bc") << std::endl;
    std::cout << 2 + 3 << " " << (32 >> (1 + 1)) << std::endl;
    return 0;
}
