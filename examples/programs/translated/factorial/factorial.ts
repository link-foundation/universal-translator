// Factorial in TypeScript, defined recursively

function factorial(number: number): number {
    if (number <= 1) {
        return 1;
    }
    return number * factorial(number - 1);
}

for (let number = 0; number < 11; number++) {
    console.log(`${number}! = ${factorial(number)}`);
}
