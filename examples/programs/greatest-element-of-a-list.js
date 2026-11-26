// Greatest element of a list in JavaScript

const numbers = [17, 4, 93, 28, 65, 3, 80];
let greatest = numbers[0];
for (const number of numbers) {
  if (number > greatest) {
    greatest = number;
  }
}
console.log(`The greatest element is ${greatest}`);
