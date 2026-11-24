// Sum digits of an integer in TypeScript

function sumOfDigits(number: number): number {
    let total = 0;
    while (number > 0) {
        total += number % 10;
        number = Math.trunc(number / 10);
    }
    return total;
}

console.log(`The digits of 1234567890 sum to ${sumOfDigits(1234567890)}`);
