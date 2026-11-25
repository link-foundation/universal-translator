// Mutual recursion in Java: the Hofstadter Female and Male sequences

class Main {
    static int female(int index) {
        if (index == 0) {
            return 1;
        }
        return index - male(female(index - 1));
    }

    static int male(int index) {
        if (index == 0) {
            return 0;
        }
        return index - female(male(index - 1));
    }

    public static void main(String[] args) {
        for (int index = 0; index < 20; index++) {
            System.out.println("" + index + ": " + female(index) + " " + male(index));
        }
    }
}
