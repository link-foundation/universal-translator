// Sum digits of an integer in Java

class Main {
    static int sumOfDigits(int number) {
        int total = 0;
        while (number > 0) {
            total += number % 10;
            number /= 10;
        }
        return total;
    }

    public static void main(String[] args) {
        System.out.println("The digits of 1234567890 sum to " + sumOfDigits(1234567890));
    }
}
