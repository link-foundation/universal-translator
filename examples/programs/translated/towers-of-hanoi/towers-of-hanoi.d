// Towers of Hanoi in D, solved recursively

import std.stdio;

void moveDisks(long count, long source, long target, long spare) {
    if (count == 0) {
        return;
    }
    moveDisks(count - 1, source, spare, target);
    writeln("Move disk ", count, " from ", source, " to ", target);
    moveDisks(count - 1, spare, target, source);
}

void main() {
    moveDisks(4, 1, 3, 2);
}
