/* Ackermann method in C#, defined recursively */

class Program {
    static int Ackermann(int first, int second) {
        if (first == 0) {
            return second + 1;
        }
        if (second == 0) {
            return Ackermann(first - 1, 1);
        }
        return Ackermann(first - 1, Ackermann(first, second - 1));
    }

    static void Main() {
        for (int first = 0; first < 4; first++) {
            for (int second = 0; second < 5; second++) {
                System.Console.WriteLine($"ackermann({first}, {second}) = {Ackermann(first, second)}");
            }
        }
    }
}
