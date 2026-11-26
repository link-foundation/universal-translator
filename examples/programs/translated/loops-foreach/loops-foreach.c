/* Loops/Foreach in C: print every element of a collection */

#include <stdio.h>

int main(void) {
    int numbers[] = {1, 1, 2, 3, 5, 8, 13, 21};
    for (int index = 0; index < (int) (sizeof numbers / sizeof numbers[0]); index++) {
        int number = numbers[index];
        printf("%d\n", number);
    }
}
