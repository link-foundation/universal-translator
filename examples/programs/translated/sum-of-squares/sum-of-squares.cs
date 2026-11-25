/* Sum of squares in C# */

class Program {
    static int SumOfSquares(int limit) {
        int total = 0;
        int number = 1;
        while (number <= limit) {
            total += number * number;
            number += 1;
        }
        return total;
    }

    static void Main() {
        int limit = 10;
        System.Console.WriteLine($"Sum of squares from 1 to {limit}:");
        System.Console.WriteLine(SumOfSquares(limit));
    }
}
