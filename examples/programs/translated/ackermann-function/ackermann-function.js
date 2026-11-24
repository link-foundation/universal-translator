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

for (let first = 0; first < 4; first++) {
    for (let second = 0; second < 5; second++) {
        console.log(`ackermann(${first}, ${second}) = ${ackermann(first, second)}`);
    }
}
