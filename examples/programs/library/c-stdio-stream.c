#include <stdio.h>

int main(void) {
    int byte;
    while ((byte = getchar()) != EOF) {
        putchar(byte);
    }
    return 0;
}
