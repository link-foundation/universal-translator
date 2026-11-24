// Perfect numbers in JavaScript: numbers equal to the sum of their divisors

function isPerfect(number) {
  let sum = 1;
  for (let divisor = 2; divisor * divisor <= number; divisor++) {
    if (number % divisor === 0) {
      sum = sum + divisor;
      if (divisor * divisor !== number) {
        sum = sum + Math.trunc(number / divisor);
      }
    }
  }
  return number > 1 && sum === number;
}

for (let number = 1; number <= 10000; number++) {
  if (isPerfect(number)) {
    console.log(number);
  }
}
