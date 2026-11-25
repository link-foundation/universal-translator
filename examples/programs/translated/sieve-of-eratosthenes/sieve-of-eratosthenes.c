/* Sieve of Eratosthenes in C: the primes up to 100 */

#include <stdio.h>

int main(void) {
    int limit = 100;
    int is_prime[limit + 1];
    for (int index = 0; index < limit + 1; index++) {
        is_prime[index] = 1;
    }
    is_prime[0] = 0;
    is_prime[1] = 0;
    for (int number = 2; number < limit + 1; number++) {
        if (is_prime[number] == 1) {
            printf("%d\n", number);
            int multiple = number * number;
            while (multiple <= limit) {
                is_prime[multiple] = 0;
                multiple += number;
            }
        }
    }
}
