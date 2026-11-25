/* Towers of Hanoi in C, solved recursively */

#include <stdio.h>

void move_disks(int count, int source, int target, int spare) {
    if (count == 0) {
        return;
    }
    move_disks(count - 1, source, spare, target);
    printf("Move disk %d from %d to %d\n", count, source, target);
    move_disks(count - 1, spare, target, source);
}

int main(void) {
    move_disks(4, 1, 3, 2);
}
