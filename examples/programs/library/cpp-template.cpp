#include <algorithm>
#include <iostream>
#include <tuple>

using namespace std;

int main() {
    if (max<unsigned>(1, -2) > 1) {
        std::cout << 1 << std::endl;
    } else {
        std::cout << 0 << std::endl;
    }
    std::cout << std::get<1>(std::make_tuple(2, 7)) << std::endl;
    return 0;
}
