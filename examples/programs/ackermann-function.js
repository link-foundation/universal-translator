// Ackermann function in JavaScript, defined recursively

function ackermann(first, second) {
  if (first === 0) {
    return second + 1;
  }
  if (second === 0) {
    return ackermann(first - 1, 1);
  }
  return ackermann(first - 1, ackermann(first, second - 1));
}

for (let first = 0; first <= 3; first++) {
  for (let second = 0; second <= 4; second++) {
    console.log(`ackermann(${first}, ${second}) = ${ackermann(first, second)}`);
  }
}
