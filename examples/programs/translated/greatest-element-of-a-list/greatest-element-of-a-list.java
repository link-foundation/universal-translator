// Greatest element of a list in Java

class Main {
    public static void main(String[] args) {
        int[] numbers = {17, 4, 93, 28, 65, 3, 80};
        int greatest = numbers[0];
        for (int number : numbers) {
            if (number > greatest) {
                greatest = number;
            }
        }
        System.out.println("The greatest element is " + greatest);
    }
}
