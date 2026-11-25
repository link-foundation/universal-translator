// Hailstone sequence in Java: count the steps to reach 1

class Main {
    static int hailstoneSteps(int number) {
        int steps = 0;
        while (number != 1) {
            if (number % 2 == 0) {
                number /= 2;
            } else {
                number = 3 * number + 1;
            }
            steps += 1;
        }
        return steps;
    }

    public static void main(String[] args) {
        for (int number = 1; number < 11; number++) {
            System.out.println("" + number + " takes " + hailstoneSteps(number) + " steps");
        }
    }
}
