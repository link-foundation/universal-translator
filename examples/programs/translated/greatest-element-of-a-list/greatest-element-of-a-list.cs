/* Greatest element of a list in C# */

class Program {
    static void Main() {
        int[] numbers = {17, 4, 93, 28, 65, 3, 80};
        int greatest = numbers[0];
        foreach (int number in numbers) {
            if (number > greatest) {
                greatest = number;
            }
        }
        System.Console.WriteLine($"The greatest element is {greatest}");
    }
}
