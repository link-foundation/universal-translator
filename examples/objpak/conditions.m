#include <stdio.h>
#include <objpak.h>

BOOL ready(BOOL active) {
    return active;
}

int remaining(void) {
    return 2;
}

int main(void) {
    BOOL active = YES;
    int n = remaining();
    while (ready(active)) {
        printf("%d\n", n);
        n--;
        active = n > 0;
    }
    if (remaining()) {
        printf("nonzero\n");
    }
    return 0;
}
