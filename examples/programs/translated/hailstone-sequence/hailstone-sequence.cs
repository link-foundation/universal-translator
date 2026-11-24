/* Hailstone sequence in C#: count the steps to reach 1 */

class Program {
    static int HailstoneSteps(int number) {
        int steps = 0;
        while (number != 1) {
            if (number % 2 == 0) {
                number /= 2;
            } else {
                number = 3 * number + 1;
            }
            steps += 1;
        }
        return steps;
    }

    static void Main() {
        for (int number = 1; number < 11; number++) {
            System.Console.WriteLine($"{number} takes {HailstoneSteps(number)} steps");
        }
    }
}
