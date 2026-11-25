/* Sum and product of an array in Objective-C */

#import <stdio.h>

int main(void) {
    int numbers[] = {1, 2, 3, 4, 5};
    int total = 0;
    int product = 1;
    for (int index = 0; index < (int) (sizeof numbers / sizeof numbers[0]); index++) {
        total += numbers[index];
        product *= numbers[index];
    }
    printf("Sum: %d\n", total);
    printf("Product: %d\n", product);
}
