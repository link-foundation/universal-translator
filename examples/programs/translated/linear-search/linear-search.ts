// Linear search in TypeScript: find the position of a value in a list

const numbers = [31, 41, 59, 26, 53, 58, 97, 93];
const wanted = 53;
let position = -1;
let current = 0;
for (const number of numbers) {
    if (number === wanted && position < 0) {
        position = current;
    }
    current += 1;
}
console.log(`Found ${wanted} at position ${position}`);
