/* Mutual recursion in C#: the Hofstadter Female and Male sequences */

class Program {
    static int Female(int index) {
        if (index == 0) {
            return 1;
        }
        return index - Male(Female(index - 1));
    }

    static int Male(int index) {
        if (index == 0) {
            return 0;
        }
        return index - Female(Male(index - 1));
    }

    static void Main() {
        for (int index = 0; index < 20; index++) {
            System.Console.WriteLine($"{index}: {Female(index)} {Male(index)}");
        }
    }
}
