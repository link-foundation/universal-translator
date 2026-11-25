// Sieve of Eratosthenes in C++: the primes up to 100

#include <iostream>
#include <vector>

int main() {
    int limit = 100;
    std::vector<int> is_prime(limit + 1, 1);
    is_prime[0] = 0;
    is_prime[1] = 0;
    for (int number = 2; number < limit + 1; number++) {
        if (is_prime[number] == 1) {
            std::cout << number << std::endl;
            int multiple = number * number;
            while (multiple <= limit) {
                is_prime[multiple] = 0;
                multiple += number;
            }
        }
    }
}
