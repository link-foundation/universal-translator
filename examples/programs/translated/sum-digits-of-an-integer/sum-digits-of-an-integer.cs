/* Sum digits of an integer in C# */

class Program {
    static int SumOfDigits(int number) {
        int total = 0;
        while (number > 0) {
            total += number % 10;
            number /= 10;
        }
        return total;
    }

    static void Main() {
        System.Console.WriteLine($"The digits of 1234567890 sum to {SumOfDigits(1234567890)}");
    }
}
