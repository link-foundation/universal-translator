/* Fibonacci sequence in C#, computed iteratively */

class Program {
    static int Fibonacci(int count) {
        int previous = 0;
        int current = 1;
        for (int step = 0; step < count; step++) {
            int next = previous + current;
            previous = current;
            current = next;
        }
        return previous;
    }

    static void Main() {
        for (int index = 0; index < 21; index++) {
            System.Console.WriteLine($"fibonacci({index}) = {Fibonacci(index)}");
        }
    }
}
