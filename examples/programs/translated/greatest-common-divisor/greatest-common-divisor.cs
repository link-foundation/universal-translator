/* Greatest common divisor in C#, using the Euclidean algorithm */

class Program {
    static int GreatestCommonDivisor(int first, int second) {
        while (second != 0) {
            int remainder = first % second;
            first = second;
            second = remainder;
        }
        return first;
    }

    static void Main() {
        System.Console.WriteLine($"The greatest common divisor of 1071 and 462 is {GreatestCommonDivisor(1071, 462)}");
    }
}
