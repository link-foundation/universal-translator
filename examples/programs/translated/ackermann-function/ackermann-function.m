/* Ackermann function in Objective-C, defined recursively */

#import <stdio.h>

int ackermann(int first, int second) {
    if (first == 0) {
        return second + 1;
    }
    if (second == 0) {
        return ackermann(first - 1, 1);
    }
    return ackermann(first - 1, ackermann(first, second - 1));
}

int main(void) {
    for (int first = 0; first < 4; first++) {
        for (int second = 0; second < 5; second++) {
            printf("ackermann(%d, %d) = %d\n", first, second, ackermann(first, second));
        }
    }
}
