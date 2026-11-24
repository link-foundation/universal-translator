// Fibonacci sequence in Dart, computed iteratively

int fibonacci(int count) {
    var previous = 0;
    var current = 1;
    for (var step = 0; step < count; step++) {
        final next = previous + current;
        previous = current;
        current = next;
    }
    return previous;
}

void main() {
    for (var index = 0; index < 21; index++) {
        print("fibonacci(${index}) = ${fibonacci(index)}");
    }
}
