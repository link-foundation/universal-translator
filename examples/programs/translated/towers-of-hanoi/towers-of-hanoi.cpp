// Towers of Hanoi in C++, solved recursively

#include <iostream>

void move_disks(int count, int source, int target, int spare) {
    if (count == 0) {
        return;
    }
    move_disks(count - 1, source, spare, target);
    std::cout << "Move disk " << count << " from " << source << " to " << target << std::endl;
    move_disks(count - 1, spare, target, source);
}

int main() {
    move_disks(4, 1, 3, 2);
}
