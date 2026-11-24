/* Leap year in C# */

class Program {
    static bool IsLeapYear(int year) {
        return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
    }

    static void Main() {
        for (int year = 1896; year < 1913; year++) {
            if (IsLeapYear(year)) {
                System.Console.WriteLine($"{year} is a leap year");
            } else {
                System.Console.WriteLine($"{year} is not a leap year");
            }
        }
    }
}
