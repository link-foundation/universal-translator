// Ackermann method in Java, defined recursively

class Main {
    static int ackermann(int first, int second) {
        if (first == 0) {
            return second + 1;
        }
        if (second == 0) {
            return ackermann(first - 1, 1);
        }
        return ackermann(first - 1, ackermann(first, second - 1));
    }

    public static void main(String[] args) {
        for (int first = 0; first < 4; first++) {
            for (int second = 0; second < 5; second++) {
                System.out.println("ackermann(" + first + ", " + second + ") = " + ackermann(first, second));
            }
        }
    }
}
