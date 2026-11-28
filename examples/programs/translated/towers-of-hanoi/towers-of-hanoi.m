/* Towers of Hanoi in Objective-C, solved recursively */

#import <stdio.h>

void moveDisks(int count, int source, int target, int spare) {
    if (count == 0) {
        return;
    }
    moveDisks(count - 1, source, spare, target);
    printf("Move disk %d from %d to %d\n", count, source, target);
    moveDisks(count - 1, spare, target, source);
}

int main(void) {
    moveDisks(4, 1, 3, 2);
    return 0;
}
