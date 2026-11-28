#include <iostream>

int seed();

int first_seed() { return 7; }

// Initialize the shared state after first_seed is available.
int shared_value = first_seed() + seed();

int seed() { return 2; }

int advance() {
    shared_value += 1;
    return shared_value;
}

int main() {
    std::cout << advance() << std::endl;
    std::cout << advance() << std::endl;
    return 0;
}
