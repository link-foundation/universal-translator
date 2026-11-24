// Mutual recursion in D: the Hofstadter Female and Male sequences

import std.stdio;

long female(long index) {
    if (index == 0) {
        return 1;
    }
    return index - male(female(index - 1));
}

long male(long index) {
    if (index == 0) {
        return 0;
    }
    return index - female(male(index - 1));
}

void main() {
    for (long index = 0; index < 20; index++) {
        writeln(index, ": ", female(index), " ", male(index));
    }
}
