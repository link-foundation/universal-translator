/* Sieve of Eratosthenes in Objective-C: the primes up to 100 */

#import <stdio.h>

int main(void) {
    int limit = 100;
    int isPrime[limit + 1];
    for (int index = 0; index < limit + 1; index++) {
        isPrime[index] = 1;
    }
    isPrime[0] = 0;
    isPrime[1] = 0;
    for (int number = 2; number < limit + 1; number++) {
        if (isPrime[number] == 1) {
            printf("%d\n", number);
            int multiple = number * number;
            while (multiple <= limit) {
                isPrime[multiple] = 0;
                multiple += number;
            }
        }
    }
}
