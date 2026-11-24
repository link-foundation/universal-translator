// Towers of Hanoi in JavaScript, solved recursively

function moveDisks(count, source, target, spare) {
    if (count === 0) {
        return;
    }
    moveDisks(count - 1, source, spare, target);
    console.log(`Move disk ${count} from ${source} to ${target}`);
    moveDisks(count - 1, spare, target, source);
}

moveDisks(4, 1, 3, 2);
