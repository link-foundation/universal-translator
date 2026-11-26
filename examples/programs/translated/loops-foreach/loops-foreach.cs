/* Loops/Foreach in C#: print every element of a collection */

class Program {
    static void Main() {
        int[] numbers = {1, 1, 2, 3, 5, 8, 13, 21};
        foreach (int number in numbers) {
            System.Console.WriteLine(number);
        }
    }
}
