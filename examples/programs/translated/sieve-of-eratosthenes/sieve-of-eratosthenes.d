// Sieve of Eratosthenes in D: the primes up to 100

import std.stdio;

void main() {
    long limit = 100;
    long[] isPrime = new long[limit + 1];
    for (long index = 0; index < limit + 1; index++) {
        isPrime[index] = 1;
    }
    isPrime[0] = 0;
    isPrime[1] = 0;
    for (long number = 2; number < limit + 1; number++) {
        if (isPrime[number] == 1) {
            writeln(number);
            long multiple = number * number;
            while (multiple <= limit) {
                isPrime[multiple] = 0;
                multiple += number;
            }
        }
    }
}
