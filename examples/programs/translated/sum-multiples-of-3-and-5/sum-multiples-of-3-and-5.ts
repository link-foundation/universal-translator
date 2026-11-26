// Sum multiples of 3 and 5 in TypeScript: the sum of the multiples below 1000

let total = 0;
for (let number = 1; number < 1000; number++) {
    if (number % 3 === 0 || number % 5 === 0) {
        total += number;
    }
}
console.log(total);
