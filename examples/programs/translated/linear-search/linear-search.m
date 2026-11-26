/* Linear search in Objective-C: find the position of a value in a list */

#import <stdio.h>

int main(void) {
    int numbers[] = {31, 41, 59, 26, 53, 58, 97, 93};
    int wanted = 53;
    int position = -1;
    int current = 0;
    for (int index = 0; index < (int) (sizeof numbers / sizeof numbers[0]); index++) {
        int number = numbers[index];
        if (number == wanted && position < 0) {
            position = current;
        }
        current += 1;
    }
    printf("Found %d at position %d\n", wanted, position);
}
