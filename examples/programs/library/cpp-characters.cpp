#include <iostream>

int main() {
    std::cout << (int)'a' << std::endl;
    std::cout << (char)97 << std::endl;
    std::cout << '\x41' << '\\' << '\'' << '\n';
    std::cout << (int)(char)(64 + 1) << std::endl;
    std::cout << sizeof(char) << " " << sizeof('a') << std::endl;
    return 0;
}
