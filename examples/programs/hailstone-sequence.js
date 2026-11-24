// Hailstone sequence in JavaScript: count the steps to reach 1

function hailstoneSteps(number) {
  let steps = 0;
  while (number !== 1) {
    if (number % 2 === 0) {
      number = Math.trunc(number / 2);
    } else {
      number = 3 * number + 1;
    }
    steps++;
  }
  return steps;
}

for (let number = 1; number <= 10; number++) {
  console.log(`${number} takes ${hailstoneSteps(number)} steps`);
}
