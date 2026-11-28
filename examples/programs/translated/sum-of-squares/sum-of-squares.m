/* Sum of squares in Objective-C */

#import <stdio.h>

int sumOfSquares(int limit) {
    int total = 0;
    int number = 1;
    while (number <= limit) {
        total += number * number;
        number += 1;
    }
    return total;
}

int main(void) {
    int limit = 10;
    printf("Sum of squares from 1 to %d:\n", limit);
    printf("%d\n", sumOfSquares(limit));
    return 0;
}
