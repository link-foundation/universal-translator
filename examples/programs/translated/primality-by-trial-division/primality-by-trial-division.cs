/* Primality by trial division in C# */

class Program {
    static bool IsPrime(int number) {
        if (number < 2) {
            return false;
        }
        int divisor = 2;
        while (divisor * divisor <= number) {
            if (number % divisor == 0) {
                return false;
            }
            divisor += 1;
        }
        return true;
    }

    static void Main() {
        for (int number = 1; number < 51; number++) {
            if (IsPrime(number)) {
                System.Console.WriteLine(number);
            }
        }
    }
}
