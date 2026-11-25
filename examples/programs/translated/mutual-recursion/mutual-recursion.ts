// Mutual recursion in TypeScript: the Hofstadter Female and Male sequences

function female(index: number): number {
    if (index === 0) {
        return 1;
    }
    return index - male(female(index - 1));
}

function male(index: number): number {
    if (index === 0) {
        return 0;
    }
    return index - female(male(index - 1));
}

for (let index = 0; index < 20; index++) {
    console.log(`${index}: ${female(index)} ${male(index)}`);
}
