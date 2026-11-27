#include <stdio.h>
int first(void) { printf("101\n"); return -7; }
int second(void) { printf("101\n"); return 3; }
int main(void) {
    printf("%d\n", (-7) / (3));
    printf("%d\n", (-7) % (3));
    printf("%d\n", (7) / (-3));
    printf("%d\n", (7) % (-3));
    printf("%d\n", (-7) / (-3));
    printf("%d\n", (-7) % (-3));
    printf("%d\n", (7) / (3));
    printf("%d\n", (7) % (3));
    printf("%d\n", (-6) / (3));
    printf("%d\n", (-6) % (3));
    printf("%d\n", (6) / (-3));
    printf("%d\n", (6) % (-3));
    printf("%d\n", (-6) / (-3));
    printf("%d\n", (-6) % (-3));
    printf("%d\n", (0) / (3));
    printf("%d\n", (0) % (3));
    printf("%d\n", (0) / (-3));
    printf("%d\n", (0) % (-3));
    printf("%d\n", (-1) / (3));
    printf("%d\n", (-1) % (3));
    printf("%d\n", (1) / (-3));
    printf("%d\n", (1) % (-3));
    printf("%d\n", (-1) / (-3));
    printf("%d\n", (-1) % (-3));
    int left = first();
    int right = second();
    printf("%d\n", left / right);
    left = first();
    right = second();
    printf("%d\n", left % right);
    int value = -7;
    value /= 3;
    printf("%d\n", value);
    value %= 2;
    printf("%d\n", value);
    return 0;
}
