// Sieve of Eratosthenes in Dart: the primes up to 100

void main() {
    final limit = 100;
    final isPrime = List.filled(limit + 1, 1);
    isPrime[0] = 0;
    isPrime[1] = 0;
    for (var number = 2; number < limit + 1; number++) {
        if (isPrime[number] == 1) {
            print(number);
            var multiple = number * number;
            while (multiple <= limit) {
                isPrime[multiple] = 0;
                multiple += number;
            }
        }
    }
}
