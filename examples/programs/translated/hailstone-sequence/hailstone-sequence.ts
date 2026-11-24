// Hailstone sequence in TypeScript: count the steps to reach 1

function hailstoneSteps(number: number): number {
    let steps = 0;
    while (number !== 1) {
        if (number % 2 === 0) {
            number = Math.trunc(number / 2);
        } else {
            number = 3 * number + 1;
        }
        steps += 1;
    }
    return steps;
}

for (let number = 1; number < 11; number++) {
    console.log(`${number} takes ${hailstoneSteps(number)} steps`);
}
