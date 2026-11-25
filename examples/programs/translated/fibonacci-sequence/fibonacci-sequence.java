// Fibonacci sequence in Java, computed iteratively

class Main {
    static int fibonacci(int count) {
        int previous = 0;
        int current = 1;
        for (int step = 0; step < count; step++) {
            int next = previous + current;
            previous = current;
            current = next;
        }
        return previous;
    }

    public static void main(String[] args) {
        for (int index = 0; index < 21; index++) {
            System.out.println("fibonacci(" + index + ") = " + fibonacci(index));
        }
    }
}
