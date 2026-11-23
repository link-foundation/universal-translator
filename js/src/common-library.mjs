function unsignedInteger(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RangeError('Expected an unsigned 32-bit integer');
  }
}

export function printLine(message) {
  console.log(message);
}

export function writeText(message) {
  process.stdout.write(message);
}

export function greatestCommonDivisor(left, right) {
  unsignedInteger(left);
  unsignedInteger(right);
  while (right !== 0) {
    [left, right] = [right, left % right];
  }
  return left;
}

export function ackermann(first, second) {
  unsignedInteger(first);
  unsignedInteger(second);
  if (first > 3 || second > 4) {
    throw new RangeError('Expected Ackermann inputs in 0..3 and 0..4');
  }
  return [second + 1, second + 2, 2 * second + 3, 2 ** (second + 3) - 3][first];
}

export function* fizzBuzzLines(limit) {
  unsignedInteger(limit);
  for (let number = 1; number <= limit; number += 1) {
    const fizz = number % 3 === 0 ? 'Fizz' : '';
    const buzz = number % 5 === 0 ? 'Buzz' : '';
    yield fizz + buzz || String(number);
  }
}
