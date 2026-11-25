/* Factorial in C#, defined recursively */

class Program {
    static int Factorial(int number) {
        if (number <= 1) {
            return 1;
        }
        return number * Factorial(number - 1);
    }

    static void Main() {
        for (int number = 0; number < 11; number++) {
            System.Console.WriteLine($"{number}! = {Factorial(number)}");
        }
    }
}
