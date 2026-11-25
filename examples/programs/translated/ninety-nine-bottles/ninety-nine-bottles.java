// 99 bottles of beer in Java

class Main {
    public static void main(String[] args) {
        int bottles = 99;
        while (bottles > 0) {
            System.out.println("" + bottles + " bottles of beer on the wall, " + bottles + " bottles of beer.");
            System.out.println("Take one down and pass it around, " + (bottles - 1) + " bottles of beer on the wall.");
            bottles -= 1;
        }
    }
}
