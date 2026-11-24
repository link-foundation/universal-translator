// Sum of squares in Java

class Main {
    static int sumOfSquares(int limit) {
        int total = 0;
        int number = 1;
        while (number <= limit) {
            total += number * number;
            number += 1;
        }
        return total;
    }

    public static void main(String[] args) {
        int limit = 10;
        System.out.println("Sum of squares from 1 to " + limit + ":");
        System.out.println(sumOfSquares(limit));
    }
}
