/* Greatest element of a list in C */

#include <stdio.h>

int main(void) {
    int numbers[] = {17, 4, 93, 28, 65, 3, 80};
    int greatest = numbers[0];
    for (int index = 0; index < (int) (sizeof numbers / sizeof numbers[0]); index++) {
        int number = numbers[index];
        if (number > greatest) {
            greatest = number;
        }
    }
    printf("The greatest element is %d\n", greatest);
}
