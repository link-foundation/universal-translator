// Greatest common divisor in Java, using the Euclidean algorithm

class Main {
    static int greatestCommonDivisor(int first, int second) {
        while (second != 0) {
            int remainder = first % second;
            first = second;
            second = remainder;
        }
        return first;
    }

    public static void main(String[] args) {
        System.out.println("The greatest common divisor of 1071 and 462 is " + greatestCommonDivisor(1071, 462));
    }
}
