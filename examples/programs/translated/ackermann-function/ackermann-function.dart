// Ackermann function in Dart, defined recursively

int ackermann(int first, int second) {
    if (first == 0) {
        return second + 1;
    }
    if (second == 0) {
        return ackermann(first - 1, 1);
    }
    return ackermann(first - 1, ackermann(first, second - 1));
}

void main() {
    for (var first = 0; first < 4; first++) {
        for (var second = 0; second < 5; second++) {
            print("ackermann(${first}, ${second}) = ${ackermann(first, second)}");
        }
    }
}
