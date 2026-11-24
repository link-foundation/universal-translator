/* Towers of Hanoi in C#, solved recursively */

class Program {
    static void MoveDisks(int count, int source, int target, int spare) {
        if (count == 0) {
            return;
        }
        MoveDisks(count - 1, source, spare, target);
        System.Console.WriteLine($"Move disk {count} from {source} to {target}");
        MoveDisks(count - 1, spare, target, source);
    }

    static void Main() {
        MoveDisks(4, 1, 3, 2);
    }
}
