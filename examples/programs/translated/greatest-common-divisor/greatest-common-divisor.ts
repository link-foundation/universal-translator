// Greatest common divisor in TypeScript, using the Euclidean algorithm

function greatestCommonDivisor(first: number, second: number): number {
    while (second !== 0) {
        const remainder = first % second;
        first = second;
        second = remainder;
    }
    return first;
}

console.log(`The greatest common divisor of 1071 and 462 is ${greatestCommonDivisor(1071, 462)}`);
