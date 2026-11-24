/* FizzBuzz in C# */

class Program {
    static void Main() {
        for (int number = 1; number < 101; number++) {
            if (number % 15 == 0) {
                System.Console.WriteLine("FizzBuzz");
            } else if (number % 3 == 0) {
                System.Console.WriteLine("Fizz");
            } else if (number % 5 == 0) {
                System.Console.WriteLine("Buzz");
            } else {
                System.Console.WriteLine(number);
            }
        }
    }
}
