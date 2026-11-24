/* 99 bottles of beer in Objective-C */

#import <stdio.h>

int main(void) {
    int bottles = 99;
    while (bottles > 0) {
        printf("%d bottles of beer on the wall, %d bottles of beer.\n", bottles, bottles);
        printf("Take one down and pass it around, %d bottles of beer on the wall.\n", bottles - 1);
        bottles -= 1;
    }
}
