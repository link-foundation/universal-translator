// Towers of Hanoi in Dart, solved recursively

void moveDisks(int count, int source, int target, int spare) {
    if (count == 0) {
        return;
    }
    moveDisks(count - 1, source, spare, target);
    print("Move disk ${count} from ${source} to ${target}");
    moveDisks(count - 1, spare, target, source);
}

void main() {
    moveDisks(4, 1, 3, 2);
}
