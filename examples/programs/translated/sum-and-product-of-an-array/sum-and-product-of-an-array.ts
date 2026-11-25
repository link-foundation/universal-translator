// Sum and product of an array in TypeScript

const numbers = [1, 2, 3, 4, 5];
let total = 0;
let product = 1;
for (let index = 0; index < numbers.length; index++) {
    total += numbers[index];
    product *= numbers[index];
}
console.log(`Sum: ${total}`);
console.log(`Product: ${product}`);
