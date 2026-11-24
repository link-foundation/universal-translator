// Perfect numbers in Java: numbers equal to the sum of their divisors

class Main {
    static boolean isPerfect(int number) {
        int sum = 1;
        int divisor = 2;
        while (divisor * divisor <= number) {
            if (number % divisor == 0) {
                sum += divisor;
                if (divisor * divisor != number) {
                    sum += number / divisor;
                }
            }
            divisor += 1;
        }
        return number > 1 && sum == number;
    }

    public static void main(String[] args) {
        for (int number = 1; number < 10001; number++) {
            if (isPerfect(number)) {
                System.out.println(number);
            }
        }
    }
}
