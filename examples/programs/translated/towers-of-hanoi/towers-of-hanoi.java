// Towers of Hanoi in Java, solved recursively

class Main {
    static void moveDisks(int count, int source, int target, int spare) {
        if (count == 0) {
            return;
        }
        moveDisks(count - 1, source, spare, target);
        System.out.println("Move disk " + count + " from " + source + " to " + target);
        moveDisks(count - 1, spare, target, source);
    }

    public static void main(String[] args) {
        moveDisks(4, 1, 3, 2);
    }
}
