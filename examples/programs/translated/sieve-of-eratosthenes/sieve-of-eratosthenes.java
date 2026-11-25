// Sieve of Eratosthenes in Java: the primes up to 100

class Main {
    public static void main(String[] args) {
        int limit = 100;
        int[] isPrime = new int[limit + 1];
        for (int index = 0; index < limit + 1; index++) {
            isPrime[index] = 1;
        }
        isPrime[0] = 0;
        isPrime[1] = 0;
        for (int number = 2; number < limit + 1; number++) {
            if (isPrime[number] == 1) {
                System.out.println(number);
                int multiple = number * number;
                while (multiple <= limit) {
                    isPrime[multiple] = 0;
                    multiple += number;
                }
            }
        }
    }
}
