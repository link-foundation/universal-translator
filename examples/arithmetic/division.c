#include <stdio.h>

int main(void) {
    printf("%d\n", (7 + 5) / (1 + 3));
    printf("%d\n", (18 - 4) / (6 - 2));
    printf("%d\n", (3 * 4) / (2 * 3));
    printf("%d\n", (20 / (2 + 3)) / (8 / 4));
    printf("%d\n", 24 / (8 / 2));
    printf("%d\n", (7 + 5) / -4);
    printf("%d\n", -7 / (1 + 2));
    printf("%d\n", -(7 + 5) / (1 + 4));
    printf("%d\n", (2 + 3) / (10 - 3));
    printf("%d\n", (2 * (3 + 4)) / (9 - 5));
    return 0;
}
