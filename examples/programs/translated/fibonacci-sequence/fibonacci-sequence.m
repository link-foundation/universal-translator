/* Fibonacci sequence in Objective-C, computed iteratively */

#import <stdio.h>

int fibonacci(int count) {
    int previous = 0;
    int current = 1;
    for (int step = 0; step < count; step++) {
        int next = previous + current;
        previous = current;
        current = next;
    }
    return previous;
}

int main(void) {
    for (int index = 0; index < 21; index++) {
        printf("fibonacci(%d) = %d\n", index, fibonacci(index));
    }
    return 0;
}
