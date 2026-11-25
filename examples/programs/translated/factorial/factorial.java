// Factorial in Java, defined recursively

class Main {
    static int factorial(int number) {
        if (number <= 1) {
            return 1;
        }
        return number * factorial(number - 1);
    }

    public static void main(String[] args) {
        for (int number = 0; number < 11; number++) {
            System.out.println("" + number + "! = " + factorial(number));
        }
    }
}
