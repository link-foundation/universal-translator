// Sieve of Eratosthenes in GameMaker Language: the primes up to 100

var limit = 100;
var is_prime = array_create(limit + 1, 1);
is_prime[0] = 0;
is_prime[1] = 0;
for (var number = 2; number < limit + 1; number++) {
    if (is_prime[number] == 1) {
        show_debug_message(number);
        var multiple = number * number;
        while (multiple <= limit) {
            is_prime[multiple] = 0;
            multiple += number;
        }
    }
}
