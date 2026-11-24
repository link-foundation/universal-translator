// Primality by trial division in Java

class Main {
    static boolean isPrime(int number) {
        if (number < 2) {
            return false;
        }
        int divisor = 2;
        while (divisor * divisor <= number) {
            if (number % divisor == 0) {
                return false;
            }
            divisor += 1;
        }
        return true;
    }

    public static void main(String[] args) {
        for (int number = 1; number < 51; number++) {
            if (isPrime(number)) {
                System.out.println(number);
            }
        }
    }
}
