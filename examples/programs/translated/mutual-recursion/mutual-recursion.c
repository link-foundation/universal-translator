/* Mutual recursion in C: the Hofstadter Female and Male sequences */

#include <stdio.h>

int female(int index) {
    if (index == 0) {
        return 1;
    }
    return index - male(female(index - 1));
}

int male(int index) {
    if (index == 0) {
        return 0;
    }
    return index - female(male(index - 1));
}

int main(void) {
    for (int index = 0; index < 20; index++) {
        printf("%d: %d %d\n", index, female(index), male(index));
    }
}
