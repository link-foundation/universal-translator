#include <stdio.h>

int main(int argument_count, char *argument_values[]) {
    if (argument_count != 3) {
        puts("Supply exactly two arguments.");
        return 7;
    }
    puts(argument_values[2]);
    puts(argument_values[1]);
    return 0;
}
