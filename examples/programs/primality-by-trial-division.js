// Primality by trial division in JavaScript

function isPrime(number) {
  if (number < 2) {
    return false;
  }
  for (let divisor = 2; divisor * divisor <= number; divisor++) {
    if (number % divisor === 0) {
      return false;
    }
  }
  return true;
}

for (let number = 1; number <= 50; number++) {
  if (isPrime(number)) {
    console.log(number);
  }
}
