// 99 bottles of beer in C++

#include <iostream>

int main() {
    int bottles = 99;
    while (bottles > 0) {
        std::cout << bottles << " bottles of beer on the wall, " << bottles << " bottles of beer." << std::endl;
        std::cout << "Take one down and pass it around, " << (bottles - 1) << " bottles of beer on the wall." << std::endl;
        bottles -= 1;
    }
}
