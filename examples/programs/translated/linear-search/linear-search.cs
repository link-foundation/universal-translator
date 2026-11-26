/* Linear search in C#: find the position of a value in a list */

class Program {
    static void Main() {
        int[] numbers = {31, 41, 59, 26, 53, 58, 97, 93};
        int wanted = 53;
        int position = -1;
        int current = 0;
        foreach (int number in numbers) {
            if (number == wanted && position < 0) {
                position = current;
            }
            current += 1;
        }
        System.Console.WriteLine($"Found {wanted} at position {position}");
    }
}
