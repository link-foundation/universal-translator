// Linear search in Java: find the position of a value in a list

class Main {
    public static void main(String[] args) {
        int[] numbers = {31, 41, 59, 26, 53, 58, 97, 93};
        int wanted = 53;
        int position = -1;
        int current = 0;
        for (int number : numbers) {
            if (number == wanted && position < 0) {
                position = current;
            }
            current += 1;
        }
        System.out.println("Found " + wanted + " at position " + position);
    }
}
