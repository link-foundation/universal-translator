// Sieve of Eratosthenes in JavaScript: the primes up to 100

const limit = 100;
const isPrime = new Array(limit + 1).fill(1);
isPrime[0] = 0;
isPrime[1] = 0;
for (let number = 2; number < limit + 1; number++) {
    if (isPrime[number] === 1) {
        console.log(number);
        let multiple = number * number;
        while (multiple <= limit) {
            isPrime[multiple] = 0;
            multiple += number;
        }
    }
}
