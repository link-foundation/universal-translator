/* 99 bottles of beer in C# */

class Program {
    static void Main() {
        int bottles = 99;
        while (bottles > 0) {
            System.Console.WriteLine($"{bottles} bottles of beer on the wall, {bottles} bottles of beer.");
            System.Console.WriteLine($"Take one down and pass it around, {bottles - 1} bottles of beer on the wall.");
            bottles -= 1;
        }
    }
}
