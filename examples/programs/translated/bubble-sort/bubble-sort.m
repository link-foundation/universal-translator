/* Bubble sort in Objective-C: sort a list of numbers */

#import <stdio.h>

int main(void) {
    int numbers[] = {5, 3, 8, 1, 9, 2, 7};
    int count = (int) (sizeof numbers / sizeof numbers[0]);
    for (int pass = 0; pass < count - 1; pass++) {
        for (int index = 0; index < count - 1 - pass; index++) {
            if (numbers[index] > numbers[index + 1]) {
                int swap = numbers[index];
                numbers[index] = numbers[index + 1];
                numbers[index + 1] = swap;
            }
        }
    }
    for (int position = 0; position < count; position++) {
        printf("%d\n", numbers[position]);
    }
}
