// Sum and product of an array in Java

class Main {
    public static void main(String[] args) {
        int[] numbers = {1, 2, 3, 4, 5};
        int total = 0;
        int product = 1;
        for (int index = 0; index < numbers.length; index++) {
            total += numbers[index];
            product *= numbers[index];
        }
        System.out.println("Sum: " + total);
        System.out.println("Product: " + product);
    }
}
