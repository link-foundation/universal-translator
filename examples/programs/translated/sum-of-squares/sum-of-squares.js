// Sum of squares in JavaScript

function sumOfSquares(limit) {
    let total = 0;
    let number = 1;
    while (number <= limit) {
        total += number * number;
        number += 1;
    }
    return total;
}

const limit = 10;
console.log(`Sum of squares from 1 to ${limit}:`);
console.log(sumOfSquares(limit));
