// Towers of Hanoi in TypeScript, solved recursively

function moveDisks(count: number, source: number, target: number, spare: number): void {
    if (count === 0) {
        return;
    }
    moveDisks(count - 1, source, spare, target);
    console.log(`Move disk ${count} from ${source} to ${target}`);
    moveDisks(count - 1, spare, target, source);
}

moveDisks(4, 1, 3, 2);
