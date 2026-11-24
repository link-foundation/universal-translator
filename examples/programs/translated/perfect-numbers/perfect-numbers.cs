/* Perfect numbers in C#: numbers equal to the sum of their divisors */

class Program {
    static bool IsPerfect(int number) {
        int sum = 1;
        int divisor = 2;
        while (divisor * divisor <= number) {
            if (number % divisor == 0) {
                sum += divisor;
                if (divisor * divisor != number) {
                    sum += number / divisor;
                }
            }
            divisor += 1;
        }
        return number > 1 && sum == number;
    }

    static void Main() {
        for (int number = 1; number < 10001; number++) {
            if (IsPerfect(number)) {
                System.Console.WriteLine(number);
            }
        }
    }
}
