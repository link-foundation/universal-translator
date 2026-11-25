// Mutual recursion in C++: the Hofstadter Female and Male sequences

#include <iostream>

int male(int index);

int female(int index) {
    if (index == 0) {
        return 1;
    }
    return index - male(female(index - 1));
}

int male(int index) {
    if (index == 0) {
        return 0;
    }
    return index - female(male(index - 1));
}

int main() {
    for (int index = 0; index < 20; index++) {
        std::cout << index << ": " << female(index) << " " << male(index) << std::endl;
    }
}
