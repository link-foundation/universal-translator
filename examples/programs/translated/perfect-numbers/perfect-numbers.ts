// Perfect numbers in TypeScript: numbers equal to the sum of their divisors

function isPerfect(number: number): boolean {
    let sum = 1;
    let divisor = 2;
    while (divisor * divisor <= number) {
        if (number % divisor === 0) {
            sum += divisor;
            if (divisor * divisor !== number) {
                sum += Math.trunc(number / divisor);
            }
        }
        divisor += 1;
    }
    return number > 1 && sum === number;
}

for (let number = 1; number < 10001; number++) {
    if (isPerfect(number)) {
        console.log(number);
    }
}
