/* Sum and product of an array in C# */

class Program {
    static void Main() {
        int[] numbers = {1, 2, 3, 4, 5};
        int total = 0;
        int product = 1;
        for (int index = 0; index < numbers.Length; index++) {
            total += numbers[index];
            product *= numbers[index];
        }
        System.Console.WriteLine($"Sum: {total}");
        System.Console.WriteLine($"Product: {product}");
    }
}
