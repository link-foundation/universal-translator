// Primality by trial division in JavaScript

function isPrime(number) {
    if (number < 2) {
        return false;
    }
    let divisor = 2;
    while (divisor * divisor <= number) {
        if (number % divisor === 0) {
            return false;
        }
        divisor += 1;
    }
    return true;
}

for (let number = 1; number < 51; number++) {
    if (isPrime(number)) {
        console.log(number);
    }
}
