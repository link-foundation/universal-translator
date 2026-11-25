// Bubble sort in JavaScript: sort a list of numbers

const numbers = [5, 3, 8, 1, 9, 2, 7];
const count = numbers.length;
for (let pass = 0; pass < count - 1; pass++) {
  for (let index = 0; index < count - 1 - pass; index++) {
    if (numbers[index] > numbers[index + 1]) {
      const swap = numbers[index];
      numbers[index] = numbers[index + 1];
      numbers[index + 1] = swap;
    }
  }
}
for (let position = 0; position < count; position++) {
  console.log(numbers[position]);
}
