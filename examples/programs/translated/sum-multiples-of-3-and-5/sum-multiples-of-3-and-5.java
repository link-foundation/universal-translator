// Sum multiples of 3 and 5 in Java: the sum of the multiples below 1000

class Main {
    public static void main(String[] args) {
        int total = 0;
        for (int number = 1; number < 1000; number++) {
            if (number % 3 == 0 || number % 5 == 0) {
                total += number;
            }
        }
        System.out.println(total);
    }
}
