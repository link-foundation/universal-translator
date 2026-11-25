// Bubble sort in Java: sort a list of numbers

class Main {
    public static void main(String[] args) {
        int[] numbers = {5, 3, 8, 1, 9, 2, 7};
        int count = numbers.length;
        for (int pass = 0; pass < count - 1; pass++) {
            for (int index = 0; index < count - 1 - pass; index++) {
                if (numbers[index] > numbers[index + 1]) {
                    int swap = numbers[index];
                    numbers[index] = numbers[index + 1];
                    numbers[index + 1] = swap;
                }
            }
        }
        for (int position = 0; position < count; position++) {
            System.out.println(numbers[position]);
        }
    }
}
