// Fibonacci sequence in JavaScript, computed iteratively

function fibonacci(count) {
    let previous = 0;
    let current = 1;
    for (let step = 0; step < count; step++) {
        const next = previous + current;
        previous = current;
        current = next;
    }
    return previous;
}

for (let index = 0; index < 21; index++) {
    console.log(`fibonacci(${index}) = ${fibonacci(index)}`);
}
